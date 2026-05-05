export interface LocalChatMessage {
  id: string;
  roomId: string;
  sender: 'me' | 'other';
  text: string;
  createdAt: string;
  ttlExpiresAt: number;
  deliveryState?: 'pending' | 'delivered' | 'read' | 'failed' | 'sent';
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGES_PER_ROOM = 1000;

function roomStorageKey(roomId: string) {
  return `chat_local_room_${roomId}`;
}

function nowMs() {
  return Date.now();
}

export function pruneExpiredMessages(messages: LocalChatMessage[]) {
  const now = nowMs();
  return messages.filter((msg) => msg.ttlExpiresAt > now);
}

export function loadRoomMessages(roomId: string) {
  try {
    const raw = localStorage.getItem(roomStorageKey(roomId));
    if (!raw) return [] as LocalChatMessage[];
    const parsed = JSON.parse(raw) as LocalChatMessage[];
    return pruneExpiredMessages(parsed);
  } catch {
    return [] as LocalChatMessage[];
  }
}

export function saveRoomMessages(roomId: string, messages: LocalChatMessage[]) {
  const filtered = pruneExpiredMessages(messages).slice(-MAX_MESSAGES_PER_ROOM);
  localStorage.setItem(roomStorageKey(roomId), JSON.stringify(filtered));
}

export function appendRoomMessage(
  roomId: string,
  message: Omit<LocalChatMessage, 'ttlExpiresAt'>,
  ttlMs = DEFAULT_TTL_MS
) {
  const existing = loadRoomMessages(roomId);
  const existingMessage = existing.find((msg) => msg.id === message.id);
  const nextMessage: LocalChatMessage = {
    ...existingMessage,
    ...message,
    ttlExpiresAt: existingMessage?.ttlExpiresAt ?? nowMs() + ttlMs,
  };
  const next = [...existing.filter((msg) => msg.id !== message.id), nextMessage].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  saveRoomMessages(roomId, next);
  return next;
}

export function updateDeliveryState(roomId: string, messageId: string, deliveryState: LocalChatMessage['deliveryState']) {
  const next = loadRoomMessages(roomId).map((msg) =>
    msg.id === messageId ? { ...msg, deliveryState } : msg
  );
  saveRoomMessages(roomId, next);
  return next;
}

export function clearRoomMessages(roomId: string) {
  localStorage.removeItem(roomStorageKey(roomId));
}
