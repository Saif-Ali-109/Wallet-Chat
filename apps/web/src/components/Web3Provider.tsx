'use client';

import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { projectId } from '../lib/ethereum';
import { getConfig } from '../lib/ethereum';
import { sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useSwitchChain, useChainId } from 'wagmi';
import { ensureSepolia } from '../lib/evmNetwork';

const wagmiConfig = getConfig();

function ChainEnforcer({ children }: { children: ReactNode }) {
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (chainId !== sepolia.id) {
      setSwitching(true);
      ensureSepolia(switchChainAsync, chainId)
        .then(() => {
          setSwitchError(null);
        })
        .catch((err) => {
          setSwitchError(err.message || 'Please switch to Sepolia network to continue.');
        })
        .finally(() => {
          setSwitching(false);
        });
    } else {
      setSwitchError(null);
    }
  }, [chainId, switchChainAsync]);

  if (chainId !== sepolia.id) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px',
        textAlign: 'center',
        background: '#0f0f0f',
        color: '#fff'
      }}>
        <h2 style={{ color: '#f59e0b', marginBottom: '12px' }}>
          ⚠️ Wrong Network Detected
        </h2>
        <p style={{ marginBottom: '16px', color: '#ccc' }}>
          Please switch to <strong>Sepolia Testnet</strong> (Chain ID: 11155111) to use Wallet Chat.
        </p>
        {switchError && (
          <p style={{ color: '#ef4444', marginBottom: '12px' }}>
            {switchError}
          </p>
        )}
        <button
          onClick={() => {
            setSwitching(true);
            setSwitchError(null);
            ensureSepolia(switchChainAsync, chainId)
              .then(() => setSwitchError(null))
              .catch((err) => setSwitchError(err.message))
              .finally(() => setSwitching(false));
          }}
          disabled={switching}
          style={{
            padding: '12px 24px',
            background: switching ? '#555' : '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: switching ? 'not-allowed' : 'pointer',
            fontSize: '16px'
          }}
        >
          {switching ? 'Switching...' : 'Switch to Sepolia'}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

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
        wagmiConfig: wagmiConfig as any,
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
    <WagmiProvider config={wagmiConfig as any}>
      <QueryClientProvider client={queryClient}>
        {mounted ? <ChainEnforcer>{children}</ChainEnforcer> : null}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
