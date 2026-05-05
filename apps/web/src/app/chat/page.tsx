'use client';

import { MessageSquare } from 'lucide-react';
import ChatClient from './ChatClient';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ChatIndexView() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background-primary">
      <div className="w-20 h-20 bg-background-secondary rounded-full flex items-center justify-center mb-6 shadow-sm border border-border">
        <MessageSquare className="w-10 h-10 text-accent" />
      </div>
      <h2 className="text-2xl font-bold mb-3 text-text-primary">Your Encrypted Conversations</h2>
      <p className="text-text-secondary max-w-sm">
        Select a contact from the list to start a secure, end-to-end encrypted chat session.
      </p>
    </div>
  );
}

function ChatPageContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');
  const publicKey = searchParams.get('publicKey');
  
  const hasParams = roomId || publicKey;

  if (hasParams) {
    return <ChatClient />;
  }

  return <ChatIndexView />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChatPageContent />
    </Suspense>
  );
}
