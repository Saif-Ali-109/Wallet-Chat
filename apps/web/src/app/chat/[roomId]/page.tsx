import ChatClient from '../ChatClient';
import { Suspense } from 'react';

export function generateStaticParams() {
  return [];
}

export default async function ChatRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background-primary">
        <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChatClient roomId={roomId} />
    </Suspense>
  );
}
