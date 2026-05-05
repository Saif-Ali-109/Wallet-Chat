'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { getApiBaseUrl, getAuthenticatedHeaders } from '../lib/api';
import { getEncryptedItem } from '../lib/storage';
import { decryptMessage, getPrivateKey } from '../lib/crypto';
import { appendRoomMessage } from '../lib/localChatStore';

const SERVER_URL = getApiBaseUrl();

export default function NotificationManager() {
  const [userId, setUserId] = useState<string | null>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const lastCountsRef = useRef<Record<string, number>>({});
  const isFirstLoad = useRef(true);
  const socketRef = useRef<Socket | null>(null);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.12);
    } catch {
      // Ignore audio API failures.
    }
  };

  useEffect(() => {
    const storedUserId = getEncryptedItem('auth_user_id');
    if (storedUserId) {
      setUserId(storedUserId);
    }
  }, [pathname]);

  // Request permission
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch contacts to get names for notifications
  useEffect(() => {
    if (!userId) return;
    const token = getEncryptedItem('auth_token');
    if (!token) return;

    const fetchContacts = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/chat/requests?userId=${userId}`, {
          headers: getAuthenticatedHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch contacts');
        }
        setContacts(data.contacts || []);
      } catch (err) {
        console.error('Failed to fetch contacts for notifications:', err);
      }
    };

    fetchContacts();
  }, [userId]);

  // Global socket connection
  useEffect(() => {
    if (!userId) return;
    const token = getEncryptedItem('auth_token');
    const storedAddress = getEncryptedItem('auth_address');
    if (!token || !storedAddress) return;

    const socket = io(SERVER_URL, {
      auth: { token },
      transports: ['polling', 'websocket'], // Allow fallback to polling if websocket fails
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 30000, // Increase timeout to 30s
      autoConnect: true,
    });
    socketRef.current = socket;
    socket.on('connect_error', (err) => {
      console.error('[Notification Socket] Connection error:', err.message);
    });
    socket.on('receive_message', async (payload: any) => {
      if (!payload?.sender) return;
      const fromAddress = payload.sender.publicAddress?.toLowerCase?.() || '';
      const myAddress = (getEncryptedItem('auth_address') || '').toLowerCase();
      if (!fromAddress || fromAddress === myAddress) return;

      const searchParams = new URLSearchParams(window.location.search);
      const currentRoomId = searchParams.get('roomId');
      const isActiveRoom = pathnameRef.current === '/chat' && currentRoomId === payload.roomId;
      if (!isActiveRoom && payload.roomId && payload.encryptedContent) {
        try {
          const privateKey = getPrivateKey(myAddress);
          if (privateKey) {
            const text = await decryptMessage(privateKey, payload.encryptedContent);
            appendRoomMessage(payload.roomId, {
              id: String(payload.id),
              roomId: payload.roomId,
              sender: 'other',
              text,
              createdAt: new Date(payload.createdAt || Date.now()).toISOString(),
              deliveryState: 'delivered',
            });
          }
        } catch (error) {
          console.error('Failed to cache incoming dashboard message:', error);
        }
      }

      if (document.hidden && Notification.permission === 'granted') {
        new Notification('New message', {
          body: 'You received a new encrypted message',
          icon: '/favicon.ico',
        });
      }
      playBeep();
    });

    const poll = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/chat/unreadCounts?userId=${userId}`, {
          headers: getAuthenticatedHeaders(),
        });
        const counts = await res.json(); // { [otherUserId]: count }
        if (!res.ok) {
          return;
        }

        // Check if any count increased
        Object.entries(counts).forEach(([otherId, count]) => {
          const prevCount = lastCountsRef.current[otherId] || 0;
          const currentCount = count as number;

          if (!isFirstLoad.current && currentCount > prevCount) {
            // New message!
            const contact = contacts.find(c => {
              const other = c.from._id === userId ? c.to : c.from;
              return other._id === otherId;
            });

            if (contact) {
              const isFromMe = contact.from._id === userId;
              const name = isFromMe ? contact.toCustomName : contact.fromCustomName;
              const otherUser = isFromMe ? contact.to : contact.from;
              const displayName = name || otherUser.username || otherUser.publicAddress.substring(0, 8) + '...';

              // Only show notification if document is hidden or we're not on the chat page with this person
              const isCurrentlyChatting = pathnameRef.current.toLowerCase().includes(otherUser.publicAddress.toLowerCase());
              
              if (document.hidden || !isCurrentlyChatting) {
                if (Notification.permission === 'granted') {
                  new Notification(`New message from ${displayName}`, {
                    body: 'Click to view the message',
                    icon: '/favicon.ico'
                  });
                }
              }
            }
          }
        });

        lastCountsRef.current = counts;
        isFirstLoad.current = false;
      } catch (err) {
        // Ignore errors
      }
    };

    const interval = setInterval(poll, 5000);
    poll(); // Initial check

    return () => {
      clearInterval(interval);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [userId]); // Only reconnect if userId changes

  // Global polling for unread messages
  useEffect(() => {
    if (!userId || pathname === '/connect') return;

    const poll = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/chat/unreadCounts?userId=${userId}`, {
          headers: getAuthenticatedHeaders(),
        });
        const counts = await res.json(); // { [otherUserId]: count }
        if (!res.ok) return;

        // Check if any count increased
        Object.entries(counts).forEach(([otherId, count]) => {
          const prevCount = lastCountsRef.current[otherId] || 0;
          const currentCount = count as number;

          if (!isFirstLoad.current && currentCount > prevCount) {
            // New message!
            const contact = contacts.find(c => {
              const other = c.from._id === userId ? c.to : c.from;
              return other._id === otherId;
            });

            if (contact) {
              const isFromMe = contact.from._id === userId;
              const name = isFromMe ? contact.toCustomName : contact.fromCustomName;
              const otherUser = isFromMe ? contact.to : contact.from;
              const displayName = name || otherUser.username || otherUser.publicAddress.substring(0, 8) + '...';

              // Only show notification if document is hidden or we're not on the chat page with this person
              const isCurrentlyChatting = pathnameRef.current.toLowerCase().includes(otherUser.publicAddress.toLowerCase());
              
              if (document.hidden || !isCurrentlyChatting) {
                if (Notification.permission === 'granted') {
                  new Notification(`New message from ${displayName}`, {
                    body: 'Click to view the message',
                    icon: '/favicon.ico'
                  });
                }
              }
            }
          }
        });

        lastCountsRef.current = counts;
        isFirstLoad.current = false;
      } catch (err) {
        // Ignore errors
      }
    };

    const interval = setInterval(poll, 5000);
    poll(); // Initial check

    return () => {
      clearInterval(interval);
    };
  }, [userId, contacts, pathname]);

  return null;
}
