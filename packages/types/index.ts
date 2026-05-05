export interface User {
  id: string;
  publicKey: string;
  username?: string;
}

export interface Message {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  roomId: string;
}

export interface ChatRoom {
  id: string;
  participants: string[];
  lastMessage?: Message;
}
