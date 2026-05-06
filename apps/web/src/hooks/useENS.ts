import { useState, useEffect, useCallback } from 'react';
import { JsonRpcProvider } from 'ethers';

const ANKR_MAINNET_RPC = process.env.NEXT_PUBLIC_ANKR_MAINNET_RPC || 'https://rpc.ankr.com/eth';

const shortenAddress = (address: string) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

export function useENS(address: string | null | undefined) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const resolveENS = useCallback(async (addr: string) => {
    try {
      const provider = new JsonRpcProvider(ANKR_MAINNET_RPC);
      const name = await provider.lookupAddress(addr);
      return name || shortenAddress(addr);
    } catch {
      return shortenAddress(addr);
    }
  }, []);

  useEffect(() => {
    if (!address) {
      setEnsName(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    resolveENS(address).then((name) => {
      setEnsName(name);
      setLoading(false);
    });
  }, [address, resolveENS]);

  return { ensName, loading, resolveENS };
}
