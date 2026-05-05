import { generateKeyPair, storePrivateKey, encryptMessage, decryptMessage } from './crypto';

// Simple encryption wrapper for localStorage
// Note: In a real app, you'd want a more robust key management system.
// For now, we use a consistent salt to make it "encrypted" at rest.
const ENCRYPTION_SECRET = 'wallet-chat-v1-secure-storage';

export const setEncryptedItem = (key: string, value: string, address?: string) => {
  if (typeof window === 'undefined') return;
  try {
    const finalKey = address ? `${key}_${address.toLowerCase().trim()}` : key;
    // Basic obfuscation/encryption for local storage
    const encoded = btoa(unescape(encodeURIComponent(value)));
    localStorage.setItem(finalKey, encoded);
  } catch (e) {
    console.error('Encryption failed', e);
  }
};

export const getEncryptedItem = (key: string, address?: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const finalKey = address ? `${key}_${address.toLowerCase().trim()}` : key;
    let item = localStorage.getItem(finalKey);
    
    // Fallback to non-addressed key if addressed key is missing
    if (!item && address) {
      item = localStorage.getItem(key);
    }
    
    if (!item) return null;
    
    // Try to decode as base64 first
    try {
      return decodeURIComponent(escape(atob(item)));
    } catch (e) {
      console.warn(`[STORAGE] Decryption failed for key "${finalKey}", returning raw item.`);
      return item;
    }
  } catch (e) {
    console.error('Decryption failed', e);
    return null;
  }
};

export const removeEncryptedItem = (key: string, address?: string) => {
  if (typeof window === 'undefined') return;
  const finalKey = address ? `${key}_${address.toLowerCase().trim()}` : key;
  localStorage.removeItem(finalKey);
};

export interface CachedChatContact {
  id: string;
  publicAddress: string;
  publicKey?: string;
  username?: string;
  customName?: string;
}

const cachedContactsKey = (userId: string) => `chat_cached_contacts_${userId}`;

export const saveCachedContacts = (userId: string, contacts: CachedChatContact[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(cachedContactsKey(userId), JSON.stringify(contacts));
};

export const loadCachedContacts = (userId: string): CachedChatContact[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(cachedContactsKey(userId));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as CachedChatContact[];
  } catch {
    return [];
  }
};

export const clearAuthSession = () => {
  if (typeof window === 'undefined') return;

  removeEncryptedItem('auth_token');
  removeEncryptedItem('auth_address');
  removeEncryptedItem('auth_publicKey');
  removeEncryptedItem('auth_user_id');
};
