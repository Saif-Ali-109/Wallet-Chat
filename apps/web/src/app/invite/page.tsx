'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserPlus, Loader2, MessageSquare, ShieldCheck, AlertCircle } from 'lucide-react';
import Navigation from '../../components/Navigation';

import { getEncryptedItem } from '../../lib/storage';
import { getAuthenticatedHeaders } from '../../lib/api';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4001';

function InvitePageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const targetPublicKey = searchParams.get('key');

  useEffect(() => {
    const storedUserId = getEncryptedItem('auth_user_id');
    const storedToken = getEncryptedItem('auth_token');
    if (!storedUserId || !storedToken) {
      // If not logged in, redirect to connect but keep the invite link info
      router.push(`/connect?invite=${targetPublicKey}`);
      return;
    }
    setUserId(storedUserId);
  }, [router, targetPublicKey]);

  const sendRequest = async () => {
    if (!userId || !targetPublicKey) return;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/chat/request`, {
        method: 'POST',
        headers: getAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ fromUserId: userId, toPublicKey: targetPublicKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send chat request');
      
      setSuccess(true);
      setTimeout(() => {
        router.push('/requests');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background-primary text-text-primary font-sans flex flex-col">
      <Navigation />
      
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-background-secondary border border-border p-8 rounded-3xl shadow-2xl text-center">
          <div className="w-20 h-20 bg-accent/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-10 h-10 text-accent" />
          </div>
          
          <h1 className="text-2xl font-bold mb-2">You're Invited!</h1>
          <p className="text-text-secondary mb-8">
            Someone shared their public key with you. Connect to start a secure, encrypted conversation.
          </p>

          <div className="bg-background-tertiary border border-border p-4 rounded-2xl mb-8 text-left">
            <p className="text-xs font-bold text-text-muted uppercase mb-1 ml-1">Public Key</p>
            <p className="text-xs font-mono text-accent break-all">{targetPublicKey}</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-800/50 text-red-400 rounded-xl flex items-center gap-3 text-left">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success ? (
            <div className="p-4 bg-green-900/20 border border-green-800/50 text-green-400 rounded-xl flex items-center justify-center gap-3 mb-6">
              <ShieldCheck className="w-6 h-6" />
              <p className="font-bold">Request Sent!</p>
            </div>
          ) : (
            <button
              onClick={sendRequest}
              disabled={loading || !userId}
              className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><UserPlus className="w-6 h-6" /> Accept Invite & Chat</>}
            </button>
          )}

          <p className="text-xs text-text-muted mt-6 italic">
            End-to-end encrypted messaging powered by Wallet Chat.
          </p>
        </div>
      </main>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary text-text-primary">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
        <p className="mt-4 text-text-muted font-medium text-lg">Loading Invitation...</p>
      </div>
    }>
      <InvitePageContent />
    </Suspense>
  );
}
