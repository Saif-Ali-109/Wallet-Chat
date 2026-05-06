'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Users, UserPlus, Loader2, LogOut } from 'lucide-react';
import Navigation from '../../components/Navigation';
import { getEncryptedItem } from '../../lib/storage';
import { clearAuthSession } from '../../lib/storage';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4001';

interface Contact {
  _id: string;
  from: { _id: string; publicAddress: string; username?: string };
  to: { _id: string; publicAddress: string; username?: string };
  status: string;
}

function DashboardContent() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const storedUserId = getEncryptedItem('auth_user_id');
      const storedAddress = getEncryptedItem('auth_address');
      
      if (!storedUserId || !storedAddress) {
        router.replace('/connect');
        return;
      }

      try {
        const res = await fetch(`${SERVER_URL}/auth/session`, {
          credentials: 'include',
        });
        
        if (!res.ok) {
          clearAuthSession();
          router.replace('/connect');
          return;
        }
        
        setUserId(storedUserId);
        setAddress(storedAddress);
      } catch {
        clearAuthSession();
        router.replace('/connect');
      }
    };
    
    checkAuth();
  }, [router]);

  const fetchContacts = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${SERVER_URL}/chat/requests`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          clearAuthSession();
          router.push('/connect');
          return;
        }
        throw new Error(data.error || 'Failed');
      }
      setContacts(data.contacts || []);
    } catch (err: any) {
      if (err.message.includes('Unauthorized')) {
        clearAuthSession();
        router.push('/connect');
        return;
      }
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  useEffect(() => {
    if (userId) fetchContacts();
  }, [userId, fetchContacts]);

  const handleLogout = () => {
    clearAuthSession();
    router.push('/connect');
  };

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  const activeContacts = contacts.filter(c => c.status === 'accepted');

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button onClick={handleLogout} className="text-red-400 hover:text-red-300 flex items-center gap-2">
          <LogOut className="w-4 h-4" /> Logout
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-background-secondary p-4 rounded-lg text-center">
          <Users className="w-6 h-6 mx-auto mb-2 text-accent" />
          <p className="text-2xl font-bold">{activeContacts.length}</p>
          <p className="text-sm text-text-muted">Contacts</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button onClick={() => router.push('/chat')} className="flex items-center gap-2 px-4 py-2 bg-accent rounded-lg hover:bg-accent/80">
          <MessageSquare className="w-4 h-4" /> New Chat
        </button>
        <button onClick={() => router.push('/requests')} className="flex items-center gap-2 px-4 py-2 bg-background-secondary rounded-lg">
          <UserPlus className="w-4 h-4" /> Requests
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-4">Recent Chats</h2>
      {activeContacts.length === 0 ? (
        <p className="text-text-muted text-center py-8">No contacts yet. Connect with someone!</p>
      ) : (
        <div className="space-y-2">
          {activeContacts.slice(0, 5).map(contact => {
            const other = contact.from._id === userId ? contact.to : contact.from;
            return (
              <div key={contact._id} onClick={() => router.push(`/chat/${contact._id}`)} className="p-3 bg-background-secondary rounded-lg cursor-pointer hover:bg-background-secondary/80">
                <p className="font-medium">{other.username || 'Anonymous'}</p>
                <p className="text-sm text-text-muted">{other.publicAddress?.slice(0, 12)}...</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-background-primary text-text-primary">
      <Navigation />
      <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin" /></div>}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
