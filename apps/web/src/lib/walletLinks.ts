export type WalletKind = 'walletconnect' | 'phantom' | 'solflare';
type BrowserKind = 'firefox' | 'chromium' | 'other';

const DEEP_LINKS: Record<WalletKind, string> = {
  walletconnect: 'https://walletconnect.com/',
  phantom: 'https://phantom.app/ul/browse/',
  solflare: 'https://solflare.com/ul/v1/browse?url=',
};

const EXTENSION_URLS: Record<WalletKind, Record<BrowserKind, string>> = {
  walletconnect: {
    firefox:
      'https://walletconnect.com/',
    chromium: 'https://walletconnect.com/',
    other: 'https://walletconnect.com/',
  },
  phantom: {
    firefox: 'https://phantom.com/download',
    chromium: 'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
    other: 'https://phantom.com/download',
  },
  solflare: {
    firefox: 'https://solflare.com/download',
    chromium: 'https://chromewebstore.google.com/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic',
    other: 'https://solflare.com/download',
  },
};

function detectBrowser(): BrowserKind {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('chrome') || ua.includes('chromium') || ua.includes('edg')) return 'chromium';
  return 'other';
}

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function getWalletExtensionUrl(wallet: WalletKind): string {
  const browser = detectBrowser();
  return EXTENSION_URLS[wallet][browser];
}

export function openWalletExtensionPage(wallet: WalletKind) {
  if (isMobile()) {
    const currentUrl = typeof window !== 'undefined' ? window.location.href.replace(/^https?:\/\//, '') : '';
    const deepLinkBase = DEEP_LINKS[wallet];
    let finalUrl = '';

    if (wallet === 'walletconnect') {
      finalUrl = `${deepLinkBase}${encodeURIComponent(window.location.href)}`;
    } else if (wallet === 'phantom') {
      finalUrl = `${deepLinkBase}${encodeURIComponent(window.location.href)}`;
    } else {
      finalUrl = `${deepLinkBase}${encodeURIComponent(window.location.href)}`;
    }

    window.location.href = finalUrl;
    return;
  }

  const url = getWalletExtensionUrl(wallet);
  window.open(url, '_blank', 'noopener,noreferrer');
}
