import { sepolia } from 'wagmi/chains';

/**
 * Mobile-safe network enforcer.
 *
 * On desktop, wagmi's `injected()` connector can call wallet_switchEthereumChain
 * directly via window.ethereum. On Android (Capacitor APK) window.ethereum is
 * undefined — the WalletConnect relay handles all wallet RPC calls.
 *
 * Pass wagmi's `switchChainAsync` here so the chain switch is routed through
 * WalletConnect → MetaMask app deep link, which works on both web and mobile.
 *
 * Usage (in a component):
 *   const { switchChainAsync } = useSwitchChain();
 *   await ensureSepolia(switchChainAsync);
 */
export async function ensureSepolia(
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>,
  currentChainId?: number
): Promise<void> {
  if (currentChainId === sepolia.id) return; // already on Sepolia, no-op

  try {
    await switchChainAsync({ chainId: sepolia.id });
  } catch (err: any) {
    // 4001 = user rejected the switch request
    if (err?.code === 4001 || /rejected/i.test(err?.message || '')) {
      throw new Error('Please switch to Sepolia network in your wallet to continue.');
    }
    throw err;
  }
}

/**
 * @deprecated Use ensureSepolia(switchChainAsync, chainId) instead.
 * This function relies on window.ethereum which is unavailable in Android WebViews.
 */
export async function ensureExpectedEvmNetwork(ethereum: any) {
  if (typeof ethereum === 'undefined') {
    console.warn(
      '[evmNetwork] window.ethereum is undefined. ' +
      'On Android APK, use ensureSepolia(switchChainAsync) instead.'
    );
    return;
  }
  const sepoliaChainId = '0xaa36a7';
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: sepoliaChainId }],
    });
  } catch (switchError: any) {
    if (switchError?.code === 4902) {
      await ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: sepoliaChainId,
          chainName: 'Sepolia Test Network',
          nativeCurrency: { name: 'SepoliaETH', symbol: 'SEP', decimals: 18 },
          rpcUrls: ['https://rpc.ankr.com/eth_sepolia'],
          blockExplorerUrls: ['https://sepolia.etherscan.io'],
        }],
      });
      return;
    }
    throw switchError;
  }
}
