'use client';

import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { projectId, config as wagmiConfig } from '../lib/ethereum';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';

export default function Web3Provider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            retryDelay: 1500,
          },
        },
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    const initializeWeb3Modal = async () => {
      if (!projectId || typeof window === 'undefined') {
        return;
      }

      const win = window as Window & { _web3ModalInitialized?: boolean };
      if (win._web3ModalInitialized) {
        return;
      }

      const { createWeb3Modal } = await import('@web3modal/wagmi/react');

      if (cancelled || win._web3ModalInitialized) {
        return;
      }

      createWeb3Modal({
        wagmiConfig,
        projectId,
        enableAnalytics: false,
        enableOnramp: false,
        themeMode: 'dark',
      });

      win._web3ModalInitialized = true;
    };

    initializeWeb3Modal()
      .catch((error) => {
        console.error('Failed to initialize Web3Modal:', error);
      })
      .finally(() => {
        if (!cancelled) {
          setMounted(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {mounted ? children : null}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
