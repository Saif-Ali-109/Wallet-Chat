'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getEncryptedItem } from '../../lib/storage';
import Navigation from '../../components/Navigation';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4001';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const checkSession = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/auth/session`, {
          credentials: 'include',
        });
        if (!res.ok) {
          router.push('/connect');
        }
      } catch {
        router.push('/connect');
      }
    };

    checkSession();
  }, [mounted, router]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-background-primary text-text-primary">
      <Navigation />
      <main className="pt-4">
        {children}
      </main>
    </div>
  );
}
