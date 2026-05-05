'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { MessageSquare, LayoutDashboard, Inbox, LogOut, Menu, X, Copy, Check, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from './ThemeProvider';
import { clearAuthSession, getEncryptedItem } from '../lib/storage';
import { copyTextToClipboard } from '../lib/clipboard';
import { useDisconnect } from 'wagmi';

export default function Navigation() {
  const [mounted, setMounted] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    setMounted(true);
    const storedAddress = getEncryptedItem('auth_address');
    const storedPublicKey = getEncryptedItem('auth_publicKey');
    if (storedAddress) {
      setPublicKey(storedPublicKey || storedAddress);
    } else {
      router.push('/connect');
    }
  }, [router]);

  // During SSR or before mounting, don't render anything that depends on client state
  if (!mounted || !publicKey) return null;

  const logout = () => {
    disconnect();
    clearAuthSession();
    router.push('/connect');
  };

  const handleCopy = async () => {
    if (!publicKey) return;

    const didCopy = await copyTextToClipboard(publicKey);
    if (!didCopy) {
      alert('Failed to copy public key');
      return;
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Requests', href: '/requests', icon: Inbox },
  ];

  return (
    <nav className="bg-background-primary border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="p-1.5 bg-accent rounded-lg">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-text-primary hidden sm:block">
                Wallet Chat
              </span>
            </Link>
            
            <div className="hidden sm:ml-10 sm:flex sm:space-x-4">
              {navItems.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    pathname === item.href
                      ? 'bg-background-tertiary text-accent'
                      : 'text-text-secondary hover:text-accent hover:bg-background-tertiary'
                  }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden min-[540px]:flex flex-col items-end min-w-0 max-w-[11rem] sm:max-w-[13rem]">
              <span className="hidden sm:block text-[10px] text-text-muted font-bold uppercase tracking-wider">Public Key</span>
              <button 
                onClick={handleCopy}
                className="flex max-w-full items-center gap-1.5 rounded-xl border border-border bg-background-secondary px-3 py-2 hover:border-accent hover:bg-background-tertiary transition-all group"
                title="Click to copy public key"
              >
                <span className="text-xs font-mono text-accent truncate max-w-full group-hover:opacity-80">
                  {publicKey.substring(0, 8)}...{publicKey.substring(publicKey.length - 8)}
                </span>
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-text-muted group-hover:text-accent" />
                )}
              </button>
            </div>
            
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-border bg-background-secondary p-2 text-text-secondary hover:border-accent hover:bg-background-tertiary hover:text-accent transition-all active:scale-95"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            <button
              onClick={logout}
              className="rounded-xl border border-border bg-background-secondary p-2 text-text-secondary hover:border-red-500/40 hover:bg-background-tertiary hover:text-red-500 transition-all active:scale-95"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>

            <div className="sm:hidden flex items-center">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="text-text-secondary hover:text-accent"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="sm:hidden bg-background-primary border-b border-border animate-in slide-in-from-top-2 duration-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center px-3 py-3 text-base font-medium rounded-md ${
                  pathname === item.href
                    ? 'bg-background-tertiary text-accent'
                    : 'text-text-secondary hover:text-accent hover:bg-background-tertiary'
                }`}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            ))}
          </div>
          <div className="pt-4 pb-3 border-t border-border px-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {publicKey[0].toUpperCase()}
                </div>
              </div>
              <div className="ml-3 flex items-center justify-between flex-1">
                <button 
                  onClick={handleCopy}
                  className="flex items-center gap-2 text-sm font-medium text-text-primary truncate max-w-[200px] hover:text-accent transition-colors"
                  title="Click to copy"
                >
                  {publicKey.substring(0, 8)}...
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-text-muted" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
