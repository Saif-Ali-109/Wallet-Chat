'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Send, UserPlus, Check, X, Loader2, AlertCircle } from 'lucide-react';
import Navigation from '../../components/Navigation';
import { getEncryptedItem } from '../../lib/storage';
import { getApiBaseUrl, getAuthenticatedHeaders } from '../../lib/api';

const SERVER_URL = getApiBaseUrl();

export default function RequestsPage() {
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [targetPublicKey, setTargetPublicKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUserId = getEncryptedItem('auth_user_id');
    const storedToken = getEncryptedItem('auth_token');
    if (!storedUserId || !storedToken) {
      router.push('/connect');
    } else {
      setUserId(storedUserId);
    }
  }, [router]);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const res = await fetch(`${SERVER_URL}/chat/requests?userId=${userId}`, {
        headers: getAuthenticatedHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch requests');
      setIncomingRequests(data.incoming || []);
      setOutgoingRequests(data.outgoing || []);
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) fetchData();
  }, [userId, fetchData]);

  const sendChatRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPublicKey.trim() || !userId) return;
    
    setActionLoading('sending');
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/chat/request`, {
        method: 'POST',
        headers: getAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ fromUserId: userId, toPublicKey: targetPublicKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send request');
      setTargetPublicKey('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const respondToRequest = async (requestId: string, status: 'accepted' | 'rejected') => {
    setActionLoading(requestId);
    try {
      const res = await fetch(`${SERVER_URL}/chat/respond`, {
        method: 'POST',
        headers: getAuthenticatedHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ requestId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to respond');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background-primary text-text-primary font-sans flex flex-col">
      <Navigation />
      
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2 text-text-primary">Chat Requests</h1>
          <p className="text-text-secondary">Connect with other wallet owners.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800/50 text-red-400 rounded-2xl flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* New Connection Form */}
          <div className="space-y-6">
            <div className="bg-background-secondary border border-border p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-accent/10 text-accent rounded-lg">
                  <UserPlus className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">New Connection</h2>
              </div>
              
              <form onSubmit={sendChatRequest} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-2 ml-1">Public Key</label>
                  <input
                    type="text"
                    value={targetPublicKey}
                    onChange={(e) => setTargetPublicKey(e.target.value)}
                    placeholder="Enter public key"
                    className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm font-mono text-text-primary placeholder:text-text-muted"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!!actionLoading}
                  className="w-full bg-accent hover:opacity-90 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                >
                  {actionLoading === 'sending' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send Request'}
                </button>
              </form>
            </div>

            {/* Outgoing Requests */}
            <div className="bg-background-tertiary border border-border p-6 rounded-3xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                  <Send className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold text-text-primary">Sent Requests</h2>
              </div>
              
              {loading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-text-muted" /></div>
              ) : outgoingRequests.length === 0 ? (
                <p className="text-text-muted text-sm text-center py-4 italic">No outgoing requests.</p>
              ) : (
                <div className="space-y-3">
                  {outgoingRequests.map((req, i) => (
                    <div key={i} className="bg-background-secondary border border-border p-4 rounded-xl flex items-center justify-between">
                      <div className="overflow-hidden">
                        <p className="text-xs font-mono text-text-muted truncate max-w-[150px]" title={req.to?.publicKey || req.toWallet}>{req.to?.publicKey || req.toWallet}</p>
                      </div>
                      <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg ${
                        req.status === 'pending' ? 'bg-yellow-900/30 text-yellow-500' :
                        req.status === 'accepted' ? 'bg-green-900/30 text-green-500' :
                        'bg-red-900/30 text-red-500'
                      }`}>
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Incoming Requests */}
          <div className="bg-background-secondary border border-border p-6 rounded-3xl h-fit">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-green-500/10 text-green-500 rounded-lg">
                <Inbox className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-bold text-text-primary">Incoming Requests</h2>
              {incomingRequests.length > 0 && (
                <span className="bg-accent text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {incomingRequests.length}
                </span>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-text-muted" /></div>
            ) : incomingRequests.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-text-muted text-sm italic">No pending invitations.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incomingRequests.map((req, i) => (
                  <div key={i} className="bg-background-tertiary border border-border p-5 rounded-2xl flex flex-col gap-4 group hover:border-accent/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-background-secondary rounded-lg flex items-center justify-center text-accent font-bold shrink-0">
                        {(req.from?.publicKey || req.from.publicAddress)[0].toUpperCase()}
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-bold text-sm truncate text-text-primary">{req.from.username || 'Encrypted User'}</p>
                        <p className="text-[10px] font-mono text-text-muted truncate" title={req.from?.publicKey || req.from.publicAddress}>{req.from?.publicKey || req.from.publicAddress}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => respondToRequest(req._id, 'accepted')} 
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white py-2 rounded-xl transition-all font-bold text-sm"
                      >
                        {actionLoading === req._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Accept</>}
                      </button>
                      <button 
                        onClick={() => respondToRequest(req._id, 'rejected')} 
                        disabled={!!actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white py-2 rounded-xl transition-all font-bold text-sm"
                      >
                        {actionLoading === req._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><X className="w-4 h-4" /> Decline</>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
