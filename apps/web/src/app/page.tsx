'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, MessageSquare, Shield, Lock } from 'lucide-react';
import { getEncryptedItem, clearAuthSession } from '../lib/storage';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4001';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const storedUserId = getEncryptedItem('auth_user_id');
        const storedAddress = getEncryptedItem('auth_address');
        
        if (!storedUserId || !storedAddress) {
          router.push('/connect');
          return;
        }
        
        const res = await fetch(`${SERVER_URL}/auth/session`, {
          credentials: 'include',
        });
        if (res.ok) {
          router.push('/dashboard');
        } else {
          clearAuthSession();
          router.push('/connect');
        }
      } catch (err) {
        clearAuthSession();
        router.push('/connect');
      } finally {
        setLoading(false);
      }
    };

    checkSession();
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
        <p className="text-text-secondary max-w-md text-center">
          End-to-end encrypted messaging for Web3. Connect your wallet to get started.
        </p>
        {loading && (
          <div className="flex items-center space-x-2 text-text-secondary">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Checking session...</span>
          </div>
        )}
      </div>
    </main>
  );
}
