'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare, Users, UserPlus, Search, ArrowRight, Loader2, Trash2, Bookmark, BookmarkPlus, X, Copy, Check } from 'lucide-react';
import Navigation from '../../components/Navigation';
import Link from 'next/link';
import { getEncryptedItem, loadCachedContacts, saveCachedContacts } from '../../lib/storage';
import { copyTextToClipboard } from '../../lib/clipboard';

import { getApiBaseUrl, getAuthenticatedHeaders } from '../../lib/api';

const SERVER_URL = getApiBaseUrl();

export default function Dashboard() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<{ [key: string]: number }>({});
  const [savedContacts, setSavedContacts] = useState<{name: string, publicKey: string}[]>([]);
  const [isAddingSaved, setIsAddingSaved] = useState(false);
  const [newSavedName, setNewSavedName] = useState('');
  const [newSavedKey, setNewSavedKey] = useState('');
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchContacts = async () => {
      const storedUserId = getEncryptedItem('auth_user_id');
      const storedAddress = getEncryptedItem('auth_address');
      const storedToken = getEncryptedItem('auth_token');

      if (!storedUserId || !storedToken) {
        console.log('[DASHBOARD] No auth found, redirecting to connect');
        router.push('/connect');
        return;
      }
      setUserId(storedUserId);
      setAddress(storedAddress);
      try {
        setLoading(true);
        const res = await fetch(`${SERVER_URL}/chat/requests?userId=${storedUserId}`, {
          headers: getAuthenticatedHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch contacts');
        }
        
        const processedContacts = (data.contacts || []).map((c: any) => {
          const isFromMe = c.from._id === storedUserId;
          const otherUser = isFromMe ? c.to : c.from;
          const customName = isFromMe ? c.fromCustomName : c.toCustomName;
          return {
            ...c,
            otherUser,
            customName
          };
        });
        setContacts(processedContacts);
        saveCachedContacts(
          storedUserId,
          processedContacts.map((contact: any) => ({
            id: contact.otherUser._id,
            publicAddress: contact.otherUser.publicAddress,
            publicKey: contact.otherUser.publicKey,
            username: contact.otherUser.username,
            customName: contact.customName,
          }))
        );
      } catch (error) {
        console.error('Error fetching contacts:', error);
        const cachedContacts = loadCachedContacts(storedUserId).map((contact) => ({
          otherUser: {
            _id: contact.id,
            publicAddress: contact.publicAddress,
            publicKey: contact.publicKey,
            username: contact.username,
          },
          customName: contact.customName,
        }));
        setContacts(cachedContacts);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
    
    // Load saved contacts from localStorage
    const storedSaved = localStorage.getItem('saved_contacts');
    if (storedSaved) {
      try {
        setSavedContacts(JSON.parse(storedSaved));
      } catch (e) {
        console.error('Failed to parse saved contacts');
      }
    }
  }, [router]);

  useEffect(() => {
    if (!userId) return;

    const fetchUnreadCounts = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/chat/unreadCounts?userId=${userId}`, {
          headers: getAuthenticatedHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setUnreadCounts(data);
        } else {
          console.error('Failed to fetch unread counts');
        }
      } catch (error) {
        console.error('Error fetching unread counts:', error);
      }
    };

    fetchUnreadCounts();
    const interval = setInterval(fetchUnreadCounts, 5000); // Refetch every 5 seconds for a responsive UI
    return () => clearInterval(interval);
  }, [userId]);



  const disconnectChat = async (e: React.MouseEvent, contactUserId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to disconnect? You will need to reconnect to chat again.')) return;
    
    try {
      const response = await fetch(`${SERVER_URL}/chat/disconnect`, {
        method: 'POST',
        headers: getAuthenticatedHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          userId,
          contactUserId
        })
      });
      if (response.ok) {
        setContacts(prev => prev.filter((c: any) => c.otherUser._id !== contactUserId));
      } else {
        const errorData = await response.json();
        alert(errorData.error || 'Failed to disconnect');
      }
    } catch (error) {
      console.error(error);
      alert('Error disconnecting');
    }
  };

  const deleteLocalChat = (e: React.MouseEvent, otherUserAddress: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('Delete all local chat history with this user? This cannot be undone.')) return;

    const roomId = [address?.toLowerCase(), otherUserAddress.toLowerCase()].sort().join('-');
    localStorage.removeItem(`chat_local_room_${roomId}`);
    alert('Local chat history deleted.');
  };

  const saveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSavedName || !newSavedKey) return;
    
    const updated = [...savedContacts, { name: newSavedName, publicKey: newSavedKey }];
    setSavedContacts(updated);
    localStorage.setItem('saved_contacts', JSON.stringify(updated));
    setNewSavedName('');
    setNewSavedKey('');
    setIsAddingSaved(false);
  };

  const removeSavedContact = (index: number) => {
    const updated = savedContacts.filter((_, i) => i !== index);
    setSavedContacts(updated);
    localStorage.setItem('saved_contacts', JSON.stringify(updated));
  };

  const copyPublicKey = async (e: React.MouseEvent, publicKey: string) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const didCopy = await copyTextToClipboard(publicKey);
      if (!didCopy) {
        throw new Error('Clipboard unavailable');
      }
      setCopiedValue(publicKey);
      window.setTimeout(() => {
        setCopiedValue((current) => current === publicKey ? null : current);
      }, 1500);
    } catch (error) {
      console.error('Failed to copy public key:', error);
      alert('Failed to copy public key');
    }
  };

  const filteredContacts = contacts.filter(c => 
    (c.otherUser.publicKey || c.otherUser.publicAddress).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.otherUser.username && c.otherUser.username.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background-primary text-text-primary font-sans flex flex-col">
      <Navigation />
      
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-text-primary">My Conversations</h1>
            <p className="text-text-secondary">Manage your secure end-to-end encrypted chats.</p>
          </div>
          <Link 
            href="/requests"
            className="flex items-center justify-center gap-2 bg-accent hover:opacity-90 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg active:scale-95 whitespace-nowrap"
          >
            <UserPlus className="w-5 h-5" />
            Find User by Public Key
          </Link>
          <button 
            onClick={() => setIsAddingSaved(true)}
            className="flex items-center justify-center gap-2 bg-background-secondary border border-border hover:border-accent text-text-primary font-bold py-3 px-6 rounded-2xl transition-all shadow-lg active:scale-95 whitespace-nowrap"
          >
            <BookmarkPlus className="w-5 h-5 text-accent" />
            Save Public Key
          </button>
        </div>

        {/* Add Saved Contact Modal */}
        {isAddingSaved && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-background-secondary border border-border w-full max-w-md p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">Save Contact</h2>
                <button onClick={() => setIsAddingSaved(false)} className="p-2 hover:bg-background-tertiary rounded-xl transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <form onSubmit={saveContact} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-2 ml-1">Contact Name</label>
                  <input
                    type="text"
                    value={newSavedName}
                    onChange={(e) => setNewSavedName(e.target.value)}
                    placeholder="e.g. Satoshi"
                    className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-text-primary"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-text-muted uppercase mb-2 ml-1">Public Key</label>
                  <input
                    type="text"
                    value={newSavedKey}
                    onChange={(e) => setNewSavedKey(e.target.value)}
                    placeholder="Enter wallet public key"
                    className="w-full bg-input-bg border border-input-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all font-mono text-sm text-text-primary"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-accent hover:opacity-90 text-white font-bold py-4 rounded-2xl transition-all shadow-lg active:scale-95"
                >
                  Save to My Contacts
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input 
            type="text"
            placeholder="Search by public key or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-input-bg border border-input-border rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:ring-2 focus:ring-accent/50 transition-all text-text-primary placeholder:text-text-muted"
          />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
            <p className="text-text-secondary">Loading your secure chats...</p>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="bg-background-secondary border border-border rounded-3xl p-12 text-center">
            <div className="w-20 h-20 bg-background-tertiary rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-10 h-10 text-text-muted" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-text-primary">No active chats found</h2>
            <p className="text-text-secondary max-w-sm mx-auto mb-8">
              {searchTerm ? "No contacts match your search term." : "You haven't started any conversations yet. Connect with other wallets to start chatting."}
            </p>
            {!searchTerm && (
              <Link 
                href="/requests"
                className="inline-flex items-center gap-2 text-accent font-bold hover:underline"
              >
                Go to Requests <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredContacts.map((contact, i) => {
              const roomId = address ? [address.toLowerCase().trim(), contact.otherUser.publicAddress.toLowerCase().trim()].sort().join('-') : null;
              const chatHref = roomId 
                ? `/chat/${roomId}` 
                : `/chat?publicKey=${encodeURIComponent(contact.otherUser.publicKey || contact.otherUser.publicAddress)}`;
              
              return (
                <div
                  key={i}
                  className="group bg-background-secondary border border-border p-6 rounded-3xl flex items-center justify-between hover:border-accent transition-all hover:shadow-xl hover:shadow-accent/5"
                >
                  <Link href={chatHref} className="flex min-w-0 flex-1 items-center gap-4 overflow-hidden">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 bg-orange-900/30 text-orange-400">
                      {(contact.otherUser.publicKey || contact.otherUser.publicAddress)[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 overflow-hidden">
                      <div className="flex justify-between items-center gap-2">
                        <h3 className="font-bold text-lg truncate text-text-primary">
                          {contact.customName || contact.otherUser.username || 'Encrypted Wallet'}
                        </h3>
                        {unreadCounts[contact.otherUser._id] > 0 && (
                          <span className="ml-2 flex items-center justify-center min-w-[22px] h-[22px] bg-red-600 text-white text-[10px] font-bold rounded-full shadow-lg shadow-red-600/30 animate-pulse-subtle border border-white/20 px-1.5 shrink-0">
                            {unreadCounts[contact.otherUser._id] > 99 ? '99+' : unreadCounts[contact.otherUser._id]}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-mono text-text-muted truncate" title={contact.otherUser.shortId || contact.otherUser.publicKey || contact.otherUser.publicAddress}>
                        {contact.otherUser.shortId || (contact.otherUser.publicKey ? `${contact.otherUser.publicKey.substring(0, 10)}...` : contact.otherUser.publicAddress)}
                      </p>
                    </div>
                  </Link>
                  <div className="ml-4 flex items-center gap-2 shrink-0">
                    <button
                      onClick={(e) => copyPublicKey(e, contact.otherUser.publicKey || contact.otherUser.publicAddress)}
                      className="p-2 bg-accent/10 text-accent rounded-xl hover:bg-accent hover:text-white transition-colors"
                      title="Copy Public Key"
                    >
                      {copiedValue === (contact.otherUser.publicKey || contact.otherUser.publicAddress) ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <button 
                      onClick={(e) => deleteLocalChat(e, contact.otherUser.publicAddress)}
                      className="p-2 bg-yellow-500/10 text-yellow-500 rounded-xl hover:bg-yellow-500 hover:text-white transition-colors"
                      title="Delete Local Chat"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={(e) => disconnectChat(e, contact.otherUser._id)}
                      className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors"
                      title="Disconnect"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <Link
                      href={chatHref}
                      className="p-2 bg-background-tertiary rounded-xl group-hover:bg-accent group-hover:text-white transition-colors text-text-secondary"
                      title="Open chat"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Saved Contacts Section */}
        <div className="mt-16 mb-10">
          <div className="flex items-center gap-3 mb-6">
            <Bookmark className="w-6 h-6 text-accent" />
            <h2 className="text-2xl font-bold">Saved Public Keys</h2>
          </div>
          
          {savedContacts.length === 0 ? (
            <div className="bg-background-secondary/50 border border-border border-dashed rounded-3xl p-10 text-center">
              <p className="text-text-muted italic">No saved public keys yet. Save keys for quick access.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedContacts.map((contact, i) => {
                // Check if this saved contact is already in active conversations
                const isActive = contacts.some(c => 
                  c.otherUser.publicKey === contact.publicKey || 
                  c.otherUser.publicAddress === contact.publicKey ||
                  c.otherUser.publicAddress.toLowerCase() === contact.publicKey.toLowerCase()
                );
                
                const activeContact = contacts.find(c => 
                  c.otherUser.publicKey === contact.publicKey || 
                  c.otherUser.publicAddress === contact.publicKey ||
                  c.otherUser.publicAddress.toLowerCase() === contact.publicKey.toLowerCase()
                );

                const roomId = address && activeContact ? [address.toLowerCase().trim(), activeContact.otherUser.publicAddress.toLowerCase().trim()].sort().join('-') : null;
                const chatHref = roomId 
                  ? `/chat/${roomId}` 
                  : `/chat?publicKey=${encodeURIComponent(contact.publicKey)}`;

                return (
                  <div key={i} className="group bg-background-secondary border border-border p-5 rounded-2xl hover:border-accent transition-all relative overflow-hidden">
                    <div className="flex justify-between items-start mb-3">
                      <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center text-accent font-bold">
                        {contact.name[0].toUpperCase()}
                      </div>
                      <button 
                        onClick={() => removeSavedContact(i)}
                        className="p-1.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h3 className="font-bold text-text-primary mb-1 truncate">{contact.name}</h3>
                    <p className="text-[10px] font-mono text-text-muted break-all select-text mb-4" title={contact.publicKey}>
                      {contact.publicKey}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => copyPublicKey(e, contact.publicKey)}
                        className="bg-background-tertiary text-text-secondary hover:bg-accent hover:text-white p-2 rounded-xl transition-all"
                        title="Copy Public Key"
                      >
                        {copiedValue === contact.publicKey ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                      {isActive ? (
                        <Link 
                          href={chatHref}
                          className="flex-1 bg-accent text-white py-2 rounded-xl text-center text-xs font-bold transition-all shadow-md hover:opacity-90"
                        >
                          Open Active Chat
                        </Link>
                      ) : (
                        <>
                          <Link 
                            href={`/chat?publicKey=${encodeURIComponent(contact.publicKey)}`}
                            className="flex-1 bg-accent/10 text-accent hover:bg-accent hover:text-white py-2 rounded-xl text-center text-xs font-bold transition-all"
                          >
                            Chat
                          </Link>
                          <Link 
                            href={`/invite?key=${encodeURIComponent(contact.publicKey)}`}
                            className="flex-1 bg-background-tertiary text-text-secondary hover:bg-background-tertiary/80 py-2 rounded-xl text-center text-xs font-bold transition-all"
                          >
                            Invite Link
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer className="mt-auto border-t border-border p-8 text-center text-xs font-medium text-text-muted">
        PEER-TO-PEER ENCRYPTED COMMUNICATION PROTOCOL v1.0
      </footer>
    </div>
  );
}
