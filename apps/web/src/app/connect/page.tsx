'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

const ConnectPageContent = dynamic(() => import('./ConnectPageContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background-primary text-text-primary">
      <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      <p className="mt-4 text-gray-500 font-medium text-lg">Loading Secure Connection...</p>
    </div>
  ),
});

export default function Page() {
  return <ConnectPageContent />;
}
