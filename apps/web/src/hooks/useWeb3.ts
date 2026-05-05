'use client';

import { useMemo } from 'react';
import { useWalletClient } from 'wagmi';
import { BrowserProvider, JsonRpcProvider } from 'ethers';

// ---------------------------------------------------------------------------
// READ-ONLY provider (Ankr RPC)
// ---------------------------------------------------------------------------
// Use this for: fetching balances, reading contract state, querying events.
// Do NOT use this to sign transactions — Ankr does not hold user private keys.
//
// Usage:
//   const provider = useReadOnlyProvider();
//   const balance = await provider.getBalance(address);
// ---------------------------------------------------------------------------
export function useReadOnlyProvider(): JsonRpcProvider {
  // [STEP 3] - Replace RPC Provider with stable public fallback
  // Hardcoding this URL ensures that even if NEXT_PUBLIC_ANKR_SEPOLIA_RPC 
  // fails to inject during the build, the app will still reach Sepolia.
  const rpcUrl =
    process.env.NEXT_PUBLIC_ANKR_SEPOLIA_RPC || 
    'https://ethereum-sepolia-rpc.publicnode.com'; // Stable Infura/Alchemy alternative

  return useMemo(() => {
    console.log('[DEBUG] Initializing JsonRpcProvider with:', rpcUrl);
    return new JsonRpcProvider(rpcUrl);
  }, [rpcUrl]);
}

// ---------------------------------------------------------------------------
// SIGNER (WalletConnect → MetaMask on Android)
// ---------------------------------------------------------------------------
// Use this for: sending transactions, calling write contract functions,
//   signing messages. This routes through WalletConnect, which deep-links
//   to the MetaMask app on Android to request the user's approval.
//
// On Android (Capacitor APK), window.ethereum is undefined — you MUST use
// walletClient.transport (the WalletConnect EIP-1193 relay) to get a signer.
//
// Usage:
//   const getSigner = useEthersSigner();
//   const signer = await getSigner();
//   const tx = await signer.sendTransaction({ to, value });
// ---------------------------------------------------------------------------
export function useEthersSigner() {
  const { data: walletClient } = useWalletClient();

  return useMemo(() => {
    if (!walletClient) return null;

    // walletClient.transport is the EIP-1193 provider vended by WalletConnect.
    // Wrapping it in BrowserProvider gives us a full ethers v6 Signer that
    // routes signing requests through WalletConnect → MetaMask deep link.
    const provider = new BrowserProvider(
      walletClient.transport as any,
      walletClient.chain.id
    );

    // Return an async getter so callers always await the ready signer
    return async () => provider.getSigner(walletClient.account.address);
  }, [walletClient]);
}
