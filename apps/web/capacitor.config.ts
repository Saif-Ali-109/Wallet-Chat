import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.securechat.app',
  appName: 'Wallet Chat',
  webDir: 'out',
  server: {
    // Setting a hostname changes your origin from 'https://localhost' to 'https://walletchat.app'
    // This is often required because many RPC providers (like Ankr/Infura) have CORS
    // policies that block requests from 'localhost' but allow custom domains.
    hostname: 'localhost',
    androidScheme: 'https',
    cleartext: true,
    // Allow navigation to any origin for debugging
    allowNavigation: [
      'walletchat.app',
      'localhost',
      '127.0.0.1',
      '*.walletchat.app',
      '192.168.0.119'
    ],
  },
};

export default config;
