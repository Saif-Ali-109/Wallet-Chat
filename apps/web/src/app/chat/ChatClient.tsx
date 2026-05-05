'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { encryptMessage, decryptMessage, getPrivateKey } from '../../lib/crypto';
import { Send, ArrowLeft, Loader2, User as UserIcon, Lock, Check, CheckCheck, Paperclip, File as FileIcon, Mic, Camera, Square, X } from 'lucide-react';
import { uploadMedia, FileAttachment } from '../../lib/media';
import MediaMessage from '../../components/chat/MediaMessage';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
import { useChatContract } from '../../hooks/useChatContract';
import { useAccount } from 'wagmi';
import { io, Socket } from 'socket.io-client';
import { appendRoomMessage, loadRoomMessages, saveRoomMessages, updateDeliveryState } from '../../lib/localChatStore';
import { clearAuthSession, getEncryptedItem, loadCachedContacts, saveCachedContacts } from '../../lib/storage';
import { getApiBaseUrl, getAuthenticatedHeaders, getNetworkErrorMessage, getSessionHealthStatus } from '../../lib/api';

const SERVER_URL = getApiBaseUrl();

interface Message {
  id: string;
  sender: 'me' | 'other';
  text: string;
  timestamp: Date;
  deliveryState?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

function mergeMessages(...messageGroups: Message[][]) {
  const merged = new Map<string, Message>();

  messageGroups.flat().forEach((message) => {
    const existing = merged.get(message.id);
    merged.set(message.id, {
      ...existing,
      ...message,
      timestamp: message.timestamp ?? existing?.timestamp ?? new Date(),
    });
  });

  return Array.from(merged.values()).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

function ChatContent() {
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();
  
  const roomIdFromParams = params?.roomId as string;
  const roomIdFromQuery = searchParams?.get('roomId');
  
  const rawTargetKey = searchParams?.get('publicKey') || '';
  const targetPublicKey = decodeURIComponent(rawTargetKey).trim();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(roomIdFromParams || roomIdFromQuery || null);
  const [initialUnreadId, setInitialUnreadId] = useState<string | null>(null);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [customName, setCustomName] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [recipientPublicKey, setRecipientPublicKey] = useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState<string | null>(null);
  const [missingPrivateKey, setMissingPrivateKey] = useState(false);
  const [socketAuthError, setSocketAuthError] = useState<string | null>(null);
  const authFailureHandledRef = useRef(false);
  const socketFailureCheckIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaUploadError, setMediaUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);


  const { isConnected, address: wagmiAddress } = useAccount();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const focusInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const handleSessionExpired = useCallback((reason: string) => {
    if (authFailureHandledRef.current) return;
    authFailureHandledRef.current = true;
    console.error('[Chat] Session expired:', reason);
    socketRef.current?.disconnect();
    socketRef.current = null;
    clearAuthSession();
    router.push('/connect');
  }, [router]);

  useEffect(() => {
    setMounted(true);
    const storedAddress = getEncryptedItem('auth_address');
    const storedUserId = getEncryptedItem('auth_user_id');
    if (!storedAddress || !storedUserId) {
      router.replace('/connect');
    }
  }, [router]);

  useEffect(() => {
    if (mounted) {
      scrollToBottom();
    }
  }, [messages, mounted]);

  useEffect(() => {
    if (mounted && isAuthorized && !loading) {
      focusInput();
    }
  }, [mounted, isAuthorized, loading, focusInput]);

  const classifySocketFailure = useCallback(async (token: string) => {
    const failureCheckId = ++socketFailureCheckIdRef.current;

    try {
      const status = await getSessionHealthStatus(token);
      const socket = socketRef.current;

      if (failureCheckId !== socketFailureCheckIdRef.current || socket?.connected) {
        return;
      }

      if (status === 'invalid') {
        handleSessionExpired('Realtime authentication failed for this room.');
        return;
      }

      if (status === 'unreachable') {
        setSocketAuthError(`${getNetworkErrorMessage()} Local chat history is still available, but realtime sync is offline.`);
        return;
      }

      setSocketAuthError('Realtime connection failed while your session is still valid. Refresh the page or reopen the room.');
    } catch (error) {
      if (failureCheckId !== socketFailureCheckIdRef.current || socketRef.current?.connected) {
        return;
      }

      console.error('[Chat] Failed to classify socket connection issue:', error);
      setSocketAuthError(`${getNetworkErrorMessage()} Local chat history is still available, but realtime sync is offline.`);
    }
  }, [handleSessionExpired]);

  const init = useCallback(async () => {
    if (!mounted) return;

    const storedAddress = getEncryptedItem('auth_address');
    const storedUserId = getEncryptedItem('auth_user_id');

    if (!storedAddress || !storedUserId) {
      router.push('/connect');
      return;
    }

    if (!getPrivateKey(storedAddress)) {
      console.warn('[Chat] Missing private key for current wallet.');
      setMissingPrivateKey(true);
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    setMyAddress(storedAddress);
    setUserId(storedUserId);

    try {
      let contacts: any[] = [];
      try {
        const res = await fetch(`${SERVER_URL}/chat/requests?userId=${storedUserId}`, {
          headers: getAuthenticatedHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch contacts');
        }
        contacts = data.contacts || [];
        saveCachedContacts(
          storedUserId,
          contacts.map((contact: any) => {
            const isFromMe = contact.from._id === storedUserId;
            const otherUser = isFromMe ? contact.to : contact.from;
            return {
              id: otherUser._id,
              publicAddress: otherUser.publicAddress,
              publicKey: otherUser.publicKey,
              username: otherUser.username,
              customName: isFromMe ? contact.fromCustomName : contact.toCustomName,
            };
          })
        );
      } catch (fetchError) {
        contacts = loadCachedContacts(storedUserId).map((contact) => ({
          from: { _id: storedUserId },
          to: {
            _id: contact.id,
            publicAddress: contact.publicAddress,
            publicKey: contact.publicKey,
            username: contact.username,
          },
          fromCustomName: contact.customName,
          toCustomName: contact.customName,
        }));
      }
      
      let activeContact = null;

      const currentRoomId = roomIdFromParams || roomIdFromQuery;
      if (currentRoomId) {
        // Find contact by roomId
        activeContact = contacts.find((c: any) => {
          const otherUser = c.from._id === storedUserId ? c.to : c.from;
          const rid = [storedAddress.toLowerCase().trim(), otherUser.publicAddress.toLowerCase().trim()].sort().join('-');
          return rid === currentRoomId;
        });
      } else if (targetPublicKey) {
        // Find contact by publicKey/address (legacy support or first hit)
        activeContact = contacts.find((c: any) => {
          const otherUser = c.from._id === storedUserId ? c.to : c.from;
          const normalizedTarget = targetPublicKey.trim();
          return (otherUser.publicKey?.trim() === normalizedTarget) || 
                 (otherUser.publicAddress?.toLowerCase() === normalizedTarget.toLowerCase());
        });
      }

      if (!activeContact) {
        setIsAuthorized(false);
        setLoading(false);
        return;
      }

      const isFromMe = activeContact.from._id === storedUserId;
      const otherUser = isFromMe ? activeContact.to : activeContact.from;
      setTargetUserId(otherUser._id);
      setRecipientPublicKey(otherUser.publicKey);
      setRecipientAddress(otherUser.publicAddress);
      setCustomName(isFromMe ? activeContact.fromCustomName : activeContact.toCustomName);
      setIsAuthorized(true);

      const rid = [storedAddress.toLowerCase().trim(), otherUser.publicAddress.toLowerCase().trim()].sort().join('-');
      setRoomId(rid);

      // If we are on /chat?publicKey=... redirect to /chat?roomId=...
      if (!roomIdFromQuery && !roomIdFromParams) {
        router.push(`/chat/${rid}`, { scroll: false });
      }

      const localMessages: Message[] = loadRoomMessages(rid).map((msg) => ({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: new Date(msg.createdAt),
        deliveryState: msg.deliveryState as any,
      }));

      // Identify the first unread message to show the separator
      const firstUnread = localMessages.find(m => m.sender === 'other' && m.deliveryState !== 'read');
      if (firstUnread) {
        setInitialUnreadId(firstUnread.id);
      }

      let nextMessages = localMessages;

      try {
        const privateKey = getPrivateKey(storedAddress);
        if (!privateKey) {
          throw new Error('Private key not found');
        }

        const res = await fetch(`${SERVER_URL}/chat/messages/${rid}?currentUserId=${storedUserId}`, {
          headers: getAuthenticatedHeaders(),
        });
        const remoteMessages = await res.json();

        if (!res.ok) {
          throw new Error(remoteMessages.error || 'Failed to fetch room messages');
        }

        const decryptedRemoteMessages: Message[] = await Promise.all(
          (remoteMessages || []).map(async (msg: any) => {
            const cipher = msg.sender === 'me'
              ? msg.encryptedContentForSender || msg.text
              : msg.text;

            let text = '(Cannot decrypt)';
            if (cipher) {
              try {
                text = await decryptMessage(privateKey, cipher);
              } catch (error) {
                console.error('Failed to decrypt synced message:', error);
              }
            }

            return {
              id: msg.id,
              sender: msg.sender,
              text,
              timestamp: new Date(msg.createdAt),
              deliveryState: msg.deliveryState as any,
            };
          })
        );

        nextMessages = mergeMessages(localMessages, decryptedRemoteMessages);
        saveRoomMessages(
          rid,
          nextMessages.map((msg) => ({
            id: msg.id,
            roomId: rid,
            sender: msg.sender,
            text: msg.text,
            createdAt: msg.timestamp.toISOString(),
            ttlExpiresAt: Date.now() + 24 * 60 * 60 * 1000,
            deliveryState: msg.deliveryState,
          }))
        );
      } catch (error) {
        console.error('Failed to sync room messages from server:', error);
      }

      setMessages(nextMessages);
      setLoading(false);
    } catch (error) {
      console.error('Init error:', error);
      setIsAuthorized(false);
      setLoading(false);
    }
  }, [targetPublicKey, roomIdFromParams, roomIdFromQuery, router, mounted]);

  useEffect(() => {
    init();
  }, [init]);

  // Mark messages as read when window is focused or messages change
  const markAsRead = useCallback(() => {
    if (!mounted || !roomId || !socketRef.current || !isAuthorized) return;
    
    const unreadFromOther = messages.filter(m => m.sender === 'other' && m.deliveryState !== 'read');
    if (unreadFromOther.length > 0) {
      unreadFromOther.forEach(m => {
        socketRef.current?.emit('message_read', { roomId, messageId: m.id });
        // Update local state
        setMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, deliveryState: 'read' } : msg));
        updateDeliveryState(roomId, m.id, 'read');
      });
      setInitialUnreadId(null);
    }
  }, [mounted, roomId, messages, isAuthorized]);

  useEffect(() => {
    if (document.visibilityState === 'visible') {
      markAsRead();
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markAsRead();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [markAsRead]);

  useEffect(() => {
    if (!mounted || !roomId || !myAddress || !isAuthorized || !recipientAddress) return;
    
    const token = getEncryptedItem('auth_token');
    if (!token) return;

    console.log(`[Socket] Connecting for room ${roomId}`);
    setSocketAuthError(null);
    const socket = io(SERVER_URL, {
      auth: { token },
      transports: ['polling', 'websocket'], 
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
    });
    
    socketRef.current = socket;

    socket.on('connect_error', (err) => {
      console.error('[Socket] Connection error:', err.message);
      
      // If the error is clearly authentication-related, expire the session immediately
      if (err.message.toLowerCase().includes('auth') || err.message.toLowerCase().includes('token')) {
        handleSessionExpired(`Authentication failed: ${err.message}`);
        return;
      }
      
      void classifySocketFailure(token);
    });

    socket.on('connect', () => {
      console.log(`[Socket] Connected! ID: ${socket.id}`);
      socketFailureCheckIdRef.current += 1;
      setSocketAuthError(null);
      const joinPayload = {
        roomId,
        otherIdentifier: recipientAddress || targetPublicKey || recipientPublicKey || undefined,
      };
      console.log('[Socket] Joining room with payload:', joinPayload);
      socket.emit('join_room', joinPayload);
    });

    socket.io.on('reconnect_attempt', () => {
      void classifySocketFailure(token);
    });

    socket.io.on('reconnect', () => {
      socketFailureCheckIdRef.current += 1;
      setSocketAuthError(null);
    });

    if (socket.connected) {
      const joinPayload = {
        roomId,
        otherIdentifier: recipientAddress || targetPublicKey || recipientPublicKey || undefined,
      };
      console.log('[Socket] Already connected, joining room with payload:', joinPayload);
      socket.emit('join_room', joinPayload);
    }

    socket.on('room_joined', (data) => {
      console.log(`[Socket] Successfully joined room: ${data.roomId}`);
    });

    socket.on('receive_message', async (msg: any) => {
      console.log('[Socket] Incoming message event:', msg.id, 'for room:', msg.roomId);
      if (msg?.roomId && msg.roomId !== roomId) {
        console.log(`[Socket] Ignoring message for non-active room ${msg.roomId}`);
        return;
      }
      if (!msg?.encryptedContent) {
        console.warn('[Socket] Message received but missing encryptedContent');
        return;
      }
      
      const isMe = msg.sender?.publicAddress?.toLowerCase() === myAddress.toLowerCase();
      console.log('[Socket] Message is from me:', isMe);
      
      // Decrypt immediately
      try {
        const privKey = getPrivateKey(myAddress);
        if (!privKey) return;
        const cipher = isMe ? msg.encryptedContentForSender : msg.encryptedContent;
        const text = cipher ? await decryptMessage(privKey, cipher) : '(Cannot decrypt)';

        const nextMessage: Message = {
          id: msg.id,
          sender: isMe ? 'me' : 'other',
          text,
          timestamp: new Date(msg.createdAt || Date.now()),
          deliveryState: isMe ? 'sent' : 'delivered',
        };

        setMessages((prev) => {
          if (prev.some((m) => m.id === nextMessage.id)) return prev;
          return [...prev, nextMessage];
        });

        appendRoomMessage(roomId, {
          id: nextMessage.id,
          roomId,
          sender: nextMessage.sender,
          text: nextMessage.text,
          createdAt: nextMessage.timestamp.toISOString(),
          deliveryState: nextMessage.deliveryState,
        });

        if (!isMe) {
          socket.emit('message_delivered', { roomId, messageId: nextMessage.id });
          if (document.visibilityState === 'visible') {
            socket.emit('message_read', { roomId, messageId: nextMessage.id });
          }
        }
      } catch (e) {
        console.error('Decryption/Process error:', e);
      }
    });

    socket.on('message_delivery_status', (payload: any) => {
      const msgId = payload.messageId || 'last_pending';
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId || (msgId === 'last_pending' && m.sender === 'me' && m.deliveryState === 'pending')) 
          ? { ...m, deliveryState: payload.delivered ? 'delivered' : 'sent' } : m)
      );
      updateDeliveryState(roomId, msgId, payload.delivered ? 'delivered' : 'sent');
    });

    socket.on('message_delivered_relay', (payload: any) => {
      const { messageId } = payload;
      setMessages((prev) => prev.map(m => m.id === messageId ? { ...m, deliveryState: 'delivered' } : m));
      updateDeliveryState(roomId, messageId, 'delivered');
    });

    socket.on('message_read_relay', (payload: any) => {
      const { messageId } = payload;
      setMessages((prev) => prev.map(m => m.id === messageId ? { ...m, deliveryState: 'read' } : m));
      updateDeliveryState(roomId, messageId, 'read');
    });

    return () => {
      socketFailureCheckIdRef.current += 1;
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, myAddress, isAuthorized, targetPublicKey, recipientAddress, recipientPublicKey, mounted, handleSessionExpired, classifySocketFailure]);

  
  const sendEncryptedMessage = async (outgoingText: string) => {
    if (!outgoingText || !roomId || !recipientPublicKey || !myAddress || !userId || sending) {
      console.warn('[sendEncryptedMessage] Missing data or sending already');
      return;
    }


    let pendingMessageId: string | null = null;

    try {
      setSending(true);
      setInput('');
      focusInput();

      const tempId = `temp-${Date.now()}`;
      pendingMessageId = tempId;
      const newMsg: Message = {
        id: tempId,
        sender: 'me',
        text: outgoingText,
        timestamp: new Date(),
        deliveryState: 'pending',
      };

      setMessages((prev) => [...prev, newMsg]);

      const privKey = getPrivateKey(myAddress);
      if (!privKey) throw new Error('Private key not found');

      console.log('[handleSend] Encrypting for recipient...');
      const encryptedContent = await encryptMessage(recipientPublicKey, outgoingText);
      const myPubKey = getEncryptedItem('auth_publicKey') || '';
      const encryptedContentForSender = await encryptMessage(myPubKey, outgoingText);

      const token = getEncryptedItem('auth_token');
      if (!token) {
        throw new Error('Session expired. Please reconnect your wallet.');
      }

      if (!socketRef.current?.connected) {
        throw new Error('Real-time connection unavailable. Please reconnect your wallet and try again.');
      }

      const socketResponse = await new Promise<{ ok: boolean; error?: string; messageId?: string; delivered?: boolean }>((resolve, reject) => {
        if (!socketRef.current) {
          reject(new Error('Real-time connection unavailable.'));
          return;
        }

        const timer = window.setTimeout(() => {
          reject(new Error('Timed out waiting for realtime delivery acknowledgement.'));
        }, 5000);

        socketRef.current.emit('send_message', {
          messageId: tempId,
          recipientPublicKey: recipientAddress,
          encryptedContent,
          encryptedContentForSender,
        }, (response: { ok: boolean; error?: string; messageId?: string; delivered?: boolean }) => {
          window.clearTimeout(timer);
          resolve(response);
        });
      });

      if (!socketResponse.ok) {
        throw new Error(socketResponse.error || 'Realtime relay failed');
      }

      const finalMessageId = socketResponse.messageId || tempId;

      setMessages((prev) => 
        prev.map((m) => m.id === tempId ? {
          ...m,
          id: finalMessageId,
          deliveryState: socketResponse.delivered ? 'delivered' : 'sent'
        } : m)
      );
      
      appendRoomMessage(roomId, {
        id: finalMessageId,
        roomId,
        sender: 'me',
        text: newMsg.text,
        createdAt: newMsg.timestamp.toISOString(),
        deliveryState: socketResponse.delivered ? 'delivered' : 'sent',
      });
    } catch (error) {
      console.error('Send error:', error);
      const message = error instanceof Error ? error.message : 'Send failed';
      if (/session expired|forbidden|invalid token|authentication/i.test(message)) {
        handleSessionExpired(message);
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === pendingMessageId ? { ...m, deliveryState: 'failed' } : m))
      );
    } finally {
      setSending(false);
      focusInput();
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const outgoingText = input.trim();
    
    if (!outgoingText && !selectedFile) return;

    if (selectedFile) {
      try {
        setMediaUploading(true);
        const { objectKey } = await uploadMedia(selectedFile);
        const payload: FileAttachment & { caption?: string } = {
          type: 'file',
          fileType: selectedFile.type || 'application/octet-stream',
          fileName: selectedFile.name,
          objectKey,
          size: selectedFile.size,
          ...(outgoingText ? { caption: outgoingText } : {})
        };
        setSelectedFile(null);
        setInput('');
        await sendEncryptedMessage(JSON.stringify(payload));
      } catch (err: any) {
        console.error('File upload failed:', err);
        setMediaUploadError(err.message || 'Failed to upload media. Please check server configuration.');
      } finally {
        setMediaUploading(false);
      }
    } else {
      setInput('');
      await sendEncryptedMessage(outgoingText);
    }
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentMenuOpen(false);
    setSelectedFile(file);
    setMediaUploadError(null);
    if (e.target) e.target.value = '';
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([audioBlob], `Voice_Message_${Date.now()}.webm`, { type: 'audio/webm' });
        setSelectedFile(file);
        setMediaUploadError(null);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      setAttachmentMenuOpen(false);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary font-sans flex flex-col">
      <Navigation />

      {loading || isAuthorized === null ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
          <p className="text-text-secondary font-medium">Establishing Secure Connection...</p>
        </div>
      ) : isAuthorized === false ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-24 h-24 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6">
            <Lock className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-text-primary">
            {missingPrivateKey ? 'Secure Key Missing' : 'Connection Unauthorized'}
          </h2>
          <p className="text-text-secondary max-w-md mb-8">
            {missingPrivateKey
              ? 'Your wallet is connected, but the local encryption key for this browser is missing. Re-open Connect to regenerate it.'
              : 'You must have an active, accepted connection request to chat with this wallet.'}
          </p>
          <Link
            href={missingPrivateKey ? '/connect' : '/dashboard'}
            className="bg-accent hover:opacity-90 text-white font-bold py-3 px-8 rounded-2xl transition-all"
          >
            {missingPrivateKey ? 'Go to Connect' : 'Return to Dashboard'}
          </Link>
        </div>
      ) : (
        <main className="flex-1 w-full max-w-5xl min-w-0 mx-auto p-4 sm:p-6 lg:p-8 flex flex-col h-[80vh] md:h-[calc(100vh-80px)]">
          {socketAuthError ? (
            <div className="mb-4 rounded-2xl border border-amber-700/40 bg-amber-900/20 px-4 py-3 text-sm text-amber-200">
              {socketAuthError}
            </div>
          ) : null}
          <div className="bg-background-secondary border border-border p-4 rounded-t-3xl flex items-center justify-between shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-4">
              <Link href="/dashboard" className="p-2 bg-background-tertiary hover:bg-background-secondary rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-text-secondary" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-accent/20 text-accent rounded-full flex items-center justify-center shrink-0 border border-accent/50 font-bold">
                  {customName ? customName[0].toUpperCase() : <UserIcon className="w-5 h-5" />}
                </div>
                <div className="flex flex-col overflow-hidden">
                  <h2 className="font-bold text-lg leading-tight truncate max-w-[200px] text-text-primary">
                    {customName || "Encrypted Contact"}
                  </h2>
                  <p className="text-[10px] font-mono text-text-muted truncate">
                    {targetPublicKey?.substring(0, 12)}...
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-background-primary border-x border-border overflow-y-auto p-4 sm:p-6 flex flex-col gap-4">
            {messages.map((msg, index) => {
              const showUnreadSeparator = initialUnreadId === msg.id;
              
              return (
                <div key={msg.id} className="flex flex-col gap-4">
                  {showUnreadSeparator && (
                    <div className="flex items-center justify-center my-6">
                      <div className="bg-background-secondary border border-border px-4 py-1.5 rounded-full shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
                        <span className="w-2 h-2 bg-accent rounded-full animate-pulse"></span>
                        <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Unread Messages Below</span>
                      </div>
                    </div>
                  )}
                  <div className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`
                      max-w-[80%] sm:max-w-[70%] p-4
                      ${msg.sender === 'me' ? 'bg-accent text-white rounded-2xl shadow-md' : 'bg-background-tertiary text-text-primary rounded-2xl border border-border'}
                    `}>
                      {(() => {
                          try {
                            const payload = JSON.parse(msg.text);
                            if (payload && payload.type === 'file') {
                              return <MediaMessage attachment={payload} />;
                            }
                          } catch {}
                          return <p className="text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap">{msg.text}</p>;
                        })()}
                      <div className={`text-[10px] mt-1.5 opacity-60 flex items-center justify-end gap-1 ${msg.sender === 'me' ? 'text-white' : 'text-text-muted'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {msg.sender === 'me' && (
                          <span className="ml-1 flex items-center">
                            {msg.deliveryState === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-400" />
                            ) : msg.deliveryState === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-white/70" />
                            ) : msg.deliveryState === 'sent' ? (
                              <Check className="w-3.5 h-3.5 text-white/70" />
                            ) : msg.deliveryState === 'failed' ? (
                              <span className="text-red-300">⚠</span>
                            ) : (
                              <div className="w-2 h-2 border-t-transparent border-white border-2 rounded-full animate-spin"></div>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
 
          <div className="bg-background-secondary border border-border p-4 rounded-b-3xl shrink-0 z-10">
            <form onSubmit={handleSend} className="flex flex-col gap-3 relative">
              {selectedFile && (
                <>
                  <div className="flex items-center justify-between p-3 bg-background-tertiary border border-border rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-accent/20 text-accent rounded-lg">
                        <FileIcon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{selectedFile.name}</span>
                        <span className="text-xs text-text-muted">{(selectedFile.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setSelectedFile(null); setMediaUploadError(null); }} className="p-2 text-text-secondary hover:text-red-400 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  {mediaUploadError && (
                    <div className="text-xs text-red-500 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                      Upload Error: {mediaUploadError}
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-3 w-full">
              {isRecording ? (
                <div className="flex-1 bg-red-500/10 border border-red-500/20 rounded-2xl px-6 py-4 flex items-center justify-between text-red-400">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="font-mono">{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={cancelRecording} className="p-2 hover:bg-red-500/20 rounded-full text-red-400"><X className="w-5 h-5"/></button>
                    <button type="button" onClick={stopRecording} className="p-2 bg-red-500 hover:bg-red-600 rounded-full text-white"><Check className="w-5 h-5"/></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)}
                      className={`p-4 rounded-2xl flex items-center justify-center transition-colors ${attachmentMenuOpen ? 'bg-accent/20 text-accent' : 'bg-background-tertiary text-text-secondary hover:text-text-primary border border-border'}`}
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                    {attachmentMenuOpen && (
                      <div className="absolute bottom-full mb-2 left-0 w-48 bg-background-secondary border border-border rounded-xl shadow-lg overflow-hidden flex flex-col z-50">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 px-4 py-3 hover:bg-background-tertiary text-left text-sm transition-colors">
                          <FileIcon className="w-4 h-4 text-blue-400" /> Select File
                        </button>
                        <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex items-center gap-3 px-4 py-3 hover:bg-background-tertiary text-left text-sm transition-colors">
                          <Camera className="w-4 h-4 text-green-400" /> Take Photo
                        </button>
                        <button type="button" onClick={startRecording} className="flex items-center gap-3 px-4 py-3 hover:bg-background-tertiary text-left text-sm transition-colors">
                          <Mic className="w-4 h-4 text-red-400" /> Record Voice
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={mediaUploading ? "Uploading..." : selectedFile ? "Add a caption..." : "Type an encrypted message..."}
                    disabled={mediaUploading}
                    autoFocus
                    className="flex-1 bg-background-tertiary border border-border rounded-2xl px-6 py-4 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                  <button
                    type="submit"
                    disabled={sending || mediaUploading || (!input.trim() && !selectedFile)}
                    className="bg-accent disabled:opacity-50 text-white rounded-2xl px-6 flex items-center justify-center transition-all hover:opacity-90 active:scale-95 shadow-md"
                  >
                    {(sending || mediaUploading) ? <Loader2 className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                  </button>
                </>
              )}
              </div>
            </form>
            <input type="file" ref={fileInputRef} onChange={onFileUpload} className="hidden" />
            <input type="file" accept="image/*,video/*" capture="environment" ref={cameraInputRef} onChange={onFileUpload} className="hidden" />
          </div>
        </main>
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background-primary flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
