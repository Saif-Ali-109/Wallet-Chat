'use client';

import ChatClient from '../ChatClient';
import { Suspense } from 'react';

// Required for output: 'export' config with dynamic routes
export function generateStaticParams() {
  return [];
}

export default function ChatRoomPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background-primary">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChatClient />
    </Suspense>
  );
}
