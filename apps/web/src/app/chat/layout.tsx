'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Loader2, Search, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { getEncryptedItem, loadCachedContacts, saveCachedContacts } from '@/lib/storage';
import { getAuthenticatedHeaders } from '@/lib/api';

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:4001';

interface Contact {
  id: string;
  publicKey: string;
  publicAddress: string;
  displayName: string;
  customName?: string;
}

function ChatLayoutContent({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const router = useRouter();
  const params = useParams();
  const activeRoomId = params.roomId as string;

  useEffect(() => {
    const storedAddress = getEncryptedItem('auth_address');
    const storedUserId = getEncryptedItem('auth_user_id');
    const storedToken = getEncryptedItem('auth_token');

    if (!storedAddress || !storedUserId || !storedToken) {
      router.push('/connect');
      return;
    }

    setCurrentUserId(storedUserId);
    setMyAddress(storedAddress);

    const fetchContacts = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/chat/requests?userId=${storedUserId}`, {
          headers: getAuthenticatedHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch contacts');
        }
        
        const list = (data.contacts || []).map((c: any) => {
          const isFromMe = c.from._id === storedUserId;
          const otherUser = isFromMe ? c.to : c.from;
          const customName = isFromMe ? c.fromCustomName : c.toCustomName;
          
          return {
            id: otherUser._id,
            publicKey: otherUser.publicKey,
            publicAddress: otherUser.publicAddress,
            displayName: otherUser.publicAddress.substring(0, 6) + '...' + otherUser.publicAddress.substring(otherUser.publicAddress.length - 4),
            customName: customName
          };
        });
        
        setContacts(list);
        saveCachedContacts(
          storedUserId,
          list.map((contact: Contact) => ({
            id: contact.id,
            publicAddress: contact.publicAddress,
            publicKey: contact.publicKey,
            customName: contact.customName,
          }))
        );
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch contacts:', error);
        setContacts(
          loadCachedContacts(storedUserId).map((contact) => ({
            id: contact.id,
            publicKey: contact.publicKey || '',
            publicAddress: contact.publicAddress,
            displayName:
              contact.publicAddress.substring(0, 6) +
              '...' +
              contact.publicAddress.substring(contact.publicAddress.length - 4),
            customName: contact.customName,
          }))
        );
        setLoading(false);
      }
    };

    fetchContacts();
  }, [router]);

  const filteredContacts = contacts.filter(c => 
    c.publicAddress.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.publicKey?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-screen bg-background-primary text-text-primary overflow-hidden">
      <div className="flex flex-1 flex-col min-[560px]:flex-row overflow-hidden">
        {/* Left Sidebar - Chat List */}
        <aside className="w-full min-[560px]:w-[280px] lg:w-[320px] xl:w-96 min-[560px]:shrink-0 border-b min-[560px]:border-b-0 min-[560px]:border-r border-border flex flex-col bg-background-secondary max-h-[32vh] min-[560px]:max-h-none">
          <div className="p-4 border-b border-border">
            <h1 className="text-xl font-bold mb-4 text-text-primary">Chats</h1>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-input-bg border border-input-border rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-sm text-text-primary placeholder:text-text-muted"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="w-12 h-12 bg-background-tertiary rounded-full flex items-center justify-center mb-3">
                  <MessageSquare className="w-6 h-6 text-text-muted" />
                </div>
                <p className="text-sm text-text-secondary">No chats found</p>
                <Link href="/dashboard" className="text-xs text-accent hover:underline mt-2">Find people in Dashboard</Link>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredContacts.map((contact) => {
                  const roomId = myAddress ? [myAddress.toLowerCase().trim(), contact.publicAddress.toLowerCase().trim()].sort().join('-') : '';
                  const isActive = activeRoomId === roomId;
                  return (
                    <Link
                      key={contact.id}
                      href={`/chat/${roomId}`}
                      className={`
                        flex items-center gap-3 p-4 hover:bg-background-tertiary transition-colors cursor-pointer
                        ${isActive ? 'bg-background-tertiary border-l-4 border-l-accent' : 'border-l-4 border-l-transparent'}
                      `}
                    >
                      <div className="w-12 h-12 bg-accent/10 text-accent rounded-full flex items-center justify-center shrink-0 border border-accent/20 font-bold">
                        {contact.publicAddress[0].toUpperCase()}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-baseline">
                          <h3 className="font-semibold truncate text-text-primary">
                            {contact.customName || contact.displayName}
                          </h3>
                        </div>
                        <p className="text-xs text-text-muted truncate">
                          {contact.publicKey.substring(0, 20)}...
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Right Panel - Chat Box */}
        <main className="flex-1 min-h-0 min-w-0 flex flex-col bg-background-primary">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex-1 flex flex-col items-center justify-center bg-background-primary">
        <Loader2 className="w-10 h-10 text-accent animate-spin" />
      </div>
    }>
      <ChatLayoutContent>{children}</ChatLayoutContent>
    </Suspense>
  );
}
