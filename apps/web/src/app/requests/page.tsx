'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Loader2, Check, X, MessageSquare, AlertCircle } from 'lucide-react';
import Navigation from '../../components/Navigation';
import { getEncryptedItem } from '../../lib/storage';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4001';

interface Contact {
  _id: string;
  from: { _id: string; publicAddress: string; username?: string };
  to: { _id: string; publicAddress: string; username?: string };
  status: 'pending' | 'accepted' | 'rejected';
}

function RequestsContent() {
  const router = useRouter();
  const [requests, setRequests] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = getEncryptedItem('auth_user_id');
    if (!storedUserId) {
      router.push('/connect');
      return;
    }
    setUserId(storedUserId);
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const fetchRequests = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/chat/requests`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch');
        setRequests(data.requests || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [userId]);

  const handleAction = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      const res = await fetch(`${SERVER_URL}/chat/request/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) throw new Error('Action failed');
      setRequests(prev => prev.filter(r => r._id !== requestId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Chat Requests</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {requests.length === 0 ? (
        <div className="text-center py-12">
          <UserPlus className="w-12 h-12 mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">No pending requests</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => {
            const otherUser = req.from._id === userId ? req.to : req.from;
            return (
              <div key={req._id} className="flex items-center justify-between p-4 bg-background-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-8 h-8 text-accent" />
                  <div>
                    <p className="font-medium">{otherUser.username || 'Anonymous'}</p>
                    <p className="text-sm text-text-muted">{otherUser.publicAddress?.slice(0, 12)}...</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleAction(req._id, 'accept')} className="p-2 bg-green-500/20 text-green-400 rounded">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleAction(req._id, 'reject')} className="p-2 bg-red-500/20 text-red-400 rounded">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RequestsPage() {
  return (
    <main className="min-h-screen bg-background-primary text-text-primary">
      <Navigation />
      <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
        <RequestsContent />
      </Suspense>
    </main>
  );
}
