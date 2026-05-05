'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare, Shield, Lock } from 'lucide-react';

import { getEncryptedItem } from '../lib/storage';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getEncryptedItem('auth_token');
    if (token) {
      router.push('/dashboard');
    } else {
      router.push('/connect');
    }
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-background-primary text-text-primary font-sans">
      <div className="flex flex-col items-center justify-center space-y-6">
        <div className="w-24 h-24 bg-accent/10 rounded-full flex items-center justify-center animate-pulse">
          <MessageSquare className="w-12 h-12 text-accent" />
        </div>
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          Secure Web3 Chat
        </h1>
        <div className="flex items-center gap-2 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
          <p>Routing to secure dashboard...</p>
        </div>
      </div>
    </main>
  );
}

declare global {
  interface Window {
    ethereum: any;
  }
}
