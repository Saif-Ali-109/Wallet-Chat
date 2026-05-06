'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getEncryptedItem } from '../../lib/storage';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4001';

export default function InvitePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const acceptInvite = useCallback(async () => {
    const key = searchParams.get('key');
    if (!key) {
      setStatus('invalid');
      setMessage('No invite key provided');
      return;
    }

    const storedAddress = getEncryptedItem('auth_address');
    if (!storedAddress) {
      router.push('/connect');
      return;
    }

    try {
      const res = await fetch(`${SERVER_URL}/chat/invite/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept invite');

      setStatus('valid');
      setMessage('Invite accepted! Redirecting...');
      setTimeout(() => router.push(`/chat/${data.roomId}`), 2000);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Something went wrong');
    }
  }, [router, searchParams]);

  useEffect(() => {
    acceptInvite();
  }, [acceptInvite]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center space-y-4">
        {status === 'loading' && <Loader2 className="w-8 h-8 animate-spin text-accent" />}
        <p className="text-lg">{message || 'Processing invite...'}</p>
      </div>
    </main>
  );
}
