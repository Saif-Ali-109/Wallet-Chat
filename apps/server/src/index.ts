import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/auth';
import chatRoutes from './routes/chat';
import mediaRoutes from './routes/media';
import notificationRoutes from './routes/notifications';
import { setOnlineSocketsRef } from './controllers/chat.controller';
import { ChatRequest } from './models/ChatRequest';
import { User } from './models/User';
import { Message } from './models/Message';
import { isFcmConfigured, sendDataNotification } from './lib/fcm';
import { JWT_SECRET, MONGODB_URI, PORT, connectDB } from './lib/constants';

const app = express();
const server = http.createServer(app);

const traceTimestamp = () => new Date().toISOString();

const truncateString = (value: string, max = 96) =>
  value.length <= max ? value : `${value.slice(0, max)}...(${value.length})`;

const summarizePayload = (value: unknown): unknown => {
  if (value == null || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return truncateString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => summarizePayload(item));
  }

  if (typeof value === 'object') {
    const summary: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase();

      if (normalizedKey.includes('token') || normalizedKey.includes('authorization')) {
        summary[key] = '<redacted>';
        continue;
      }

      if (
        normalizedKey.includes('encryptedcontent') ||
        normalizedKey === 'publickey' ||
        normalizedKey === 'signature'
      ) {
        const stringValue = typeof nestedValue === 'string' ? nestedValue : JSON.stringify(nestedValue);
        summary[key] = {
          preview: truncateString(stringValue, 48),
          length: stringValue.length,
        };
        continue;
      }

      summary[key] = summarizePayload(nestedValue);
    }

    return summary;
  }

  return String(value);
};

const logTrace = (scope: string, event: string, details?: Record<string, unknown>) => {
  const suffix = details ? ` ${JSON.stringify(summarizePayload(details))}` : '';
  console.log(`[TRACE ${traceTimestamp()}] [${scope}] ${event}${suffix}`);
};

// ---------------------------------------------------------------------------
// 1. Security & Performance Middleware
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  app.use(helmet()); // Adds security headers (XSS, Clickjacking, etc.)
}
app.use(cookieParser());
app.use(compression()); // Gzip compression for smaller response sizes
app.use(morgan('combined')); // Production-grade logging

// Rate Limiting: Prevent brute-force and DDoS
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/auth', limiter); // Apply stricter limit to auth routes
app.use('/chat', limiter); // Apply limiter to chat routes (especially /request)

// Define allowed origins
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',')
  : ['http://localhost:3000', 'http://192.168.0.119:3000', 'https://walletchat.app'];

app.use(cors({
  origin: (origin, callback) => {
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json({ limit: '10kb' })); // Body limit to prevent large payload attacks

let httpTraceId = 0;

app.use((req, res, next) => {
  const reqId = `http-${++httpTraceId}`;
  const startedAt = Date.now();

  logTrace('HTTP', 'REQUEST', {
    reqId,
    method: req.method,
    path: req.originalUrl,
    query: req.query,
    body: req.body,
    origin: req.headers.origin || null,
    ip: req.ip,
  });

  res.on('finish', () => {
    logTrace('HTTP', 'RESPONSE', {
      reqId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

// ---------------------------------------------------------------------------
// 2. Socket.IO Setup
// ---------------------------------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? allowedOrigins : (origin, callback) => callback(null, true),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
});

const onlineSocketsByUserId = new Map<string, Set<string>>();

// ---------------------------------------------------------------------------
// 3. Routes
// ---------------------------------------------------------------------------
app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);
app.use('/media', mediaRoutes);
app.use('/notifications', notificationRoutes);

// Pass the online sockets map reference to the chat controller
setOnlineSocketsRef(onlineSocketsByUserId);

// ---------------------------------------------------------------------------
// 4. Socket.IO Logic
// ---------------------------------------------------------------------------

// Rate limiting: track last message time per socket
const messageTimestamps = new Map<string, number>();

io.use((socket, next) => {
  // Try socket auth first (for backward compatibility)
  let token = socket.handshake.auth?.token;
  
  // If not in auth, try to parse from cookies
  if (!token) {
    const cookieHeader = socket.handshake.headers.cookie;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split('; ').map(c => c.split('='))
      );
      token = cookies['token'];
    }
  }

  if (!token) {
    console.log('[Socket Auth] REJECTED: No token provided');
    return next(new Error('Authentication error: No token provided'));
  }

  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) {
      console.log(`[Socket Auth] REJECTED: ${err.message}. User needs to re-connect wallet.`);
      return next(new Error('Authentication error: Invalid token'));
    }
    console.log(`[Socket Auth] VERIFIED: ${decoded.publicAddress}`);
    socket.data.user = decoded;
    next();
  });
});

const getRoomId = (addrA: string, addrB: string) => {
  if (!addrA || !addrB) return null;
  return [addrA.toLowerCase().trim(), addrB.toLowerCase().trim()].sort().join('-');
};

const isParticipantRoomId = (roomId: string, userAddress: string) => {
  const normalizedAddress = userAddress.toLowerCase().trim();
  const participants = roomId.split('-').map((part) => part.toLowerCase().trim());
  return participants.length === 2 && participants.includes(normalizedAddress);
};

const getSocketRooms = (socket: { rooms: Set<string> }) => Array.from(socket.rooms.values());
const getRoomMembers = (roomId: string) => Array.from(io.sockets.adapter.rooms.get(roomId) ?? []);
const getOnlineSocketsForUser = (userId: string) => Array.from(onlineSocketsByUserId.get(userId) ?? []);

io.on('connection', (socket) => {
  const currentUser = socket.data.user;
  if (!currentUser || !currentUser.publicAddress) {
    console.log('[Socket] DISCONNECT: Missing user data');
    return socket.disconnect();
  }

  const currentUserId = String(currentUser.id || currentUser._id);
  console.log(`[Socket] CONNECTED: ${currentUser.publicAddress} (ID: ${currentUserId})`);
  logTrace('SOCKET', 'CONNECTED', {
    socketId: socket.id,
    userId: currentUserId,
    publicAddress: currentUser.publicAddress,
    handshakeAddress: socket.handshake.address,
    transport: socket.conn.transport.name,
  });
  
  const userSockets = onlineSocketsByUserId.get(currentUserId) ?? new Set<string>();
  userSockets.add(socket.id);
  onlineSocketsByUserId.set(currentUserId, userSockets);
  socket.join(`user:${currentUserId}`);
  io.emit('user_online', { userId: currentUserId });
  logTrace('SOCKET', 'USER_ROOM_JOINED', {
    socketId: socket.id,
    userId: currentUserId,
    userRoom: `user:${currentUserId}`,
    userSocketIds: getOnlineSocketsForUser(currentUserId),
    rooms: getSocketRooms(socket),
    totalOnlineUsers: onlineSocketsByUserId.size,
  });

  socket.onAny((event, ...args) => {
    logTrace('SOCKET-IN', event, {
      socketId: socket.id,
      userId: currentUserId,
      publicAddress: currentUser.publicAddress,
      rooms: getSocketRooms(socket),
      args,
    });
  });

  const anySocket = socket as typeof socket & {
    onAnyOutgoing?: (listener: (event: string, ...args: unknown[]) => void) => void;
  };

  if (typeof anySocket.onAnyOutgoing === 'function') {
    anySocket.onAnyOutgoing((event, ...args) => {
      logTrace('SOCKET-OUT', event, {
        socketId: socket.id,
        userId: currentUserId,
        publicAddress: currentUser.publicAddress,
        rooms: getSocketRooms(socket),
        args,
      });
    });
  }

  socket.on('join_room', async (payload: string | { roomId?: string; otherIdentifier?: string }) => {
    const requestedRoomId = typeof payload === 'object' && payload !== null ? payload.roomId : undefined;
    const otherIdentifier = typeof payload === 'object' && payload !== null ? payload.otherIdentifier : payload;

    if (requestedRoomId && isParticipantRoomId(requestedRoomId, currentUser.publicAddress)) {
      socket.join(requestedRoomId);
      const clientsInRoom = getRoomMembers(requestedRoomId);
      console.log(`[Socket] ROOM JOINED BY ID: ${currentUser.publicAddress} -> [${requestedRoomId}]`);
      console.log(`[Socket] ROOM STATUS: Room [${requestedRoomId}] now has ${clientsInRoom.length} active participant(s).`);
      logTrace('ROOM', 'JOIN_BY_ID', {
        socketId: socket.id,
        userId: currentUserId,
        publicAddress: currentUser.publicAddress,
        requestedRoomId,
        roomMembers: clientsInRoom,
        socketRooms: getSocketRooms(socket),
      });
      socket.emit('room_joined', { roomId: requestedRoomId });
      return;
    }

    if (!otherIdentifier) {
      console.log('[Socket] JOIN FAILED: No identifier provided');
      logTrace('ROOM', 'JOIN_FAILED', {
        socketId: socket.id,
        userId: currentUserId,
        reason: 'missing_identifier',
        payload,
      });
      return;
    }
    
    try {
      const normalizedIdentifier = otherIdentifier.trim();
      console.log(`[Socket] ${currentUser.publicAddress} is requesting to join chat with: ${normalizedIdentifier.substring(0, 10)}...`);

      // 1. Resolve the other user to get their canonical wallet address
      let otherUser = await User.findOne({ publicKey: normalizedIdentifier });
      
      if (!otherUser) {
        // Try searching by address
        otherUser = await User.findOne({ publicAddress: normalizedIdentifier.toLowerCase() });
      }
      
      if (!otherUser) {
        // Try searching by MongoDB ID
        otherUser = await User.findById(normalizedIdentifier).catch(() => null);
      }
      
      if (!otherUser || !otherUser.publicAddress) {
        console.log(`[Socket] JOIN FAILED: Could not resolve "${normalizedIdentifier}" to a valid wallet address.`);
        logTrace('ROOM', 'JOIN_FAILED', {
          socketId: socket.id,
          userId: currentUserId,
          reason: 'user_not_resolved',
          otherIdentifier: normalizedIdentifier,
        });
        return;
      }

      // 2. Generate the SHARDED Room ID (AddressA-AddressB)
      const roomId = getRoomId(currentUser.publicAddress, otherUser.publicAddress);
      if (!roomId) return;

      // 3. Force join the shared room
      socket.join(roomId);
      
      const clientsInRoom = getRoomMembers(roomId);
      console.log(`[Socket] ROOM SYNC: User ${currentUser.publicAddress} successfully merged into room [${roomId}]`);
      console.log(`[Socket] ROOM STATUS: Room [${roomId}] now has ${clientsInRoom.length} active participant(s).`);
      logTrace('ROOM', 'JOIN_RESOLVED', {
        socketId: socket.id,
        userId: currentUserId,
        publicAddress: currentUser.publicAddress,
        otherUserId: String(otherUser._id),
        otherUserAddress: otherUser.publicAddress,
        roomId,
        roomMembers: clientsInRoom,
        socketRooms: getSocketRooms(socket),
      });
      
      socket.emit('room_joined', { roomId });
    } catch (err) {
      console.error('[Socket Join Error]', err);
      logTrace('ROOM', 'JOIN_ERROR', {
        socketId: socket.id,
        userId: currentUserId,
        error: err instanceof Error ? err.message : String(err),
        payload,
      });
    }
  });

  socket.on('send_message', async (
    data,
    ack?: (payload: { ok: boolean; error?: string; messageId?: string; delivered?: boolean }) => void
  ) => {
    try {
      // Rate limiting: max 1 msg per 500ms
      const now = Date.now();
      const last = messageTimestamps.get(socket.id) || 0;
      if (now - last < 500) {
        socket.emit('error', { message: 'Too many messages' });
        ack?.({ ok: false, error: 'Too many messages' });
        return;
      }
      messageTimestamps.set(socket.id, now);

      const { messageId, recipientPublicKey: recipientIdentifier, encryptedContent } = data;
      if (!recipientIdentifier || !encryptedContent) {
        console.log('[Socket] SEND FAILED: Missing recipient or content');
        logTrace('MESSAGE', 'SEND_FAILED', {
          socketId: socket.id,
          userId: currentUserId,
          reason: 'missing_recipient_or_content',
          data,
        });
        ack?.({ ok: false, error: 'Missing recipient or content' });
        return;
      }
      
      const normalizedRecipient = recipientIdentifier.trim();
      
      let recipientUser = await User.findOne({ publicKey: normalizedRecipient });
      if (!recipientUser) {
        recipientUser = await User.findOne({ publicAddress: normalizedRecipient.toLowerCase() });
      }
      
      if (!recipientUser) {
        recipientUser = await User.findById(normalizedRecipient).catch(() => null);
      }

      if (!recipientUser || !recipientUser.publicAddress) {
        console.log(`[Socket] SEND FAILED: Recipient ${normalizedRecipient.substring(0, 10)} not found`);
        logTrace('MESSAGE', 'SEND_FAILED', {
          socketId: socket.id,
          userId: currentUserId,
          reason: 'recipient_not_found',
          recipientIdentifier: normalizedRecipient,
        });
        ack?.({ ok: false, error: 'Recipient not found' });
        return;
      }

      const request = await ChatRequest.findOne({
        $or: [
          { from: currentUserId, to: recipientUser._id },
          { from: recipientUser._id, to: currentUserId }
        ],
        status: 'accepted'
      });

      if (!request) {
        ack?.({ ok: false, error: 'No accepted connection between these users' });
        return;
      }

      const roomId = getRoomId(currentUser.publicAddress, recipientUser.publicAddress);
      if (!roomId) return;

      const relayPayload = {
        id: messageId || `relay-${Date.now()}`,
        sender: {
          id: currentUserId,
          publicAddress: currentUser.publicAddress,
        },
        roomId,
        encryptedContent,
        encryptedContentForSender: data.encryptedContentForSender || null,
        createdAt: new Date().toISOString(),
        relayOnly: false,
      };

      try {
        const dbMsg = await Message.create({
          _id: relayPayload.id.startsWith('relay-') ? undefined : relayPayload.id,
          sender: currentUserId,
          roomId,
          encryptedContent,
          encryptedContentForSender: data.encryptedContentForSender || null,
          timestamp: new Date(relayPayload.createdAt),
        });
        relayPayload.id = dbMsg._id.toString();
      } catch (err) {
        console.error('[Socket] Failed to persist message:', err);
      }
      
      // Target 1: The shared room
      const recipientId = String(recipientUser._id || recipientUser.id);
      const recipientSockets = onlineSocketsByUserId.get(recipientId);
      const senderSockets = getOnlineSocketsForUser(currentUserId);
      const recipientSocketIds = getOnlineSocketsForUser(recipientId);
      const targetRooms = Array.from(new Set([
        roomId,
        `user:${recipientId}`,
        `user:${currentUserId}`,
      ]));
      let emitter = io.to(targetRooms[0]);
      targetRooms.slice(1).forEach((target) => {
        emitter = emitter.to(target);
      });

      console.log(`[Socket] MESSAGE RELAY: ${currentUser.publicAddress} -> ${recipientUser.publicAddress}`);
      console.log(`[Socket] TARGETING: ${targetRooms.join(', ')} with ${recipientSockets?.size || 0} recipient socket(s) online`);
      logTrace('MESSAGE', 'RELAY_PREPARED', {
        messageId: relayPayload.id,
        roomId,
        senderUserId: currentUserId,
        senderAddress: currentUser.publicAddress,
        senderSocketIds: senderSockets,
        recipientUserId: recipientId,
        recipientAddress: recipientUser.publicAddress,
        recipientSocketIds,
        targetRooms,
        relayPayload,
      });
      
      emitter.emit('receive_message', relayPayload);
      logTrace('MESSAGE', 'RELAY_EMITTED', {
        messageId: relayPayload.id,
        roomId,
        targetRooms,
        roomMembers: getRoomMembers(roomId),
        senderSocketIds: senderSockets,
        recipientSocketIds,
      });

      socket.emit('message_delivery_status', {
        recipientPublicKey: recipientIdentifier,
        messageId: relayPayload.id,
        delivered: !!recipientSockets && recipientSockets.size > 0,
        relayOnly: true,
      });
      logTrace('MESSAGE', 'DELIVERY_STATUS_EMITTED', {
        messageId: relayPayload.id,
        senderSocketId: socket.id,
        recipientIdentifier,
        delivered: !!recipientSockets && recipientSockets.size > 0,
        recipientSocketIds,
      });
      ack?.({
        ok: true,
        messageId: relayPayload.id,
        delivered: !!recipientSockets && recipientSockets.size > 0,
      });
    } catch (error) {
      console.error('[Socket Send Error]', error);
      logTrace('MESSAGE', 'SEND_ERROR', {
        socketId: socket.id,
        userId: currentUserId,
        error: error instanceof Error ? error.message : String(error),
        data,
      });
      ack?.({ ok: false, error: error instanceof Error ? error.message : 'Socket send failed' });
    }
  });

  socket.on('message_delivered', async (data: { roomId: string, messageId: string }) => {
    const { roomId, messageId } = data;
    if (!roomId || !messageId) {
      return;
    }
    
    // We emit to the specific room, but also to the users' personal rooms
    socket.to(roomId).emit('message_delivered_relay', { messageId });
    
    try {
      const msg = await Message.findById(messageId);
      if (msg) {
        io.to(`user:${msg.sender.toString()}`).to(`user:${currentUserId}`).emit('message_delivered_relay', { messageId });
      }
    } catch (e) {
      console.error('Failed to sync message_delivered to user rooms', e);
    }
  });

  socket.on('message_read', async (data: { roomId: string, messageId: string }) => {
    const { roomId, messageId } = data;
    if (!roomId || !messageId) {
      return;
    }
    
    socket.to(roomId).emit('message_read_relay', { messageId });
    
    try {
      const msg = await Message.findByIdAndUpdate(messageId, { read: true });
      if (msg) {
        io.to(`user:${msg.sender.toString()}`).to(`user:${currentUserId}`).emit('message_read_relay', { messageId });
      }
    } catch (e) {
      console.error('Failed to sync message_read to user rooms', e);
    }
  });

  socket.on('typing_start', ({ roomId }) => {
    socket.to(roomId).emit('user_typing', {
      userId: currentUserId,
      roomId
    });
  });

  socket.on('typing_stop', ({ roomId }) => {
    socket.to(roomId).emit('user_stopped_typing', {
      userId: currentUserId,
      roomId  
    });
  });

  socket.on('disconnect', () => {
    const ownedSockets = onlineSocketsByUserId.get(currentUserId);
    if (ownedSockets) {
      ownedSockets.delete(socket.id);
      if (ownedSockets.size === 0) {
        onlineSocketsByUserId.delete(currentUserId);
        io.emit('user_offline', { userId: currentUserId });
      }
    }
    console.log(`[Socket] DISCONNECTED: ${currentUser.publicAddress}`);
    logTrace('SOCKET', 'DISCONNECTED', {
      socketId: socket.id,
      userId: currentUserId,
      publicAddress: currentUser.publicAddress,
      remainingUserSocketIds: getOnlineSocketsForUser(currentUserId),
      totalOnlineUsers: onlineSocketsByUserId.size,
    });

    // Clean up rate limiting data
    messageTimestamps.delete(socket.id);
  });
});

// ---------------------------------------------------------------------------
// 5. Database & Server Lifecycle
// ---------------------------------------------------------------------------

async function startServer() {
  try {
    // Production should NEVER use in-memory DB
    if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is required in production');
    }

    await connectDB();
    console.log('Connected to MongoDB');

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Server failed to start:', error);
    process.exit(1);
  }
}

// Graceful Shutdown
async function shutdown(signal: string) {
  console.log(`Received ${signal}. Closing server...`);
  server.close(async () => {
    await mongoose.disconnect();
    console.log('Server and DB connection closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

void startServer();
