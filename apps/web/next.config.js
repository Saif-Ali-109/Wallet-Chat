const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'export', // Disabled for Next.js 15 - dynamic routes need server runtime

  images: {
    unoptimized: true,
  },

  transpilePackages: [
    'lucide-react',
  ],

  webpack: (config, { isServer }) => {
    // Only apply browser polyfills for client-side builds
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        'pino-pretty': false,
        'thread-stream': false,
        porto: false,
        bufferutil: false,
        'utf-8-validate': false,
        worker_threads: false,
        perf_hooks: false,
        diagnostics_channel: false,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        http: require.resolve('stream-http'),
        https: require.resolve('https-browserify'),
        url: require.resolve('url/'),
        zlib: require.resolve('browserify-zlib'),
        path: require.resolve('path-browserify'),
        os: require.resolve('os-browserify/browser'),
        assert: require.resolve('assert/'),
        process: require.resolve('process/browser'),
        buffer: require.resolve('buffer/'),
        util: require.resolve('util/'),
        events: require.resolve('events/'),
        module: false,
        dns: false,
        child_process: false,
        readline: false,
        accounts: false,
      };

      config.plugins.push(
        new (require('webpack')).ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }

    // Aliases for packages that need special resolution
    config.resolve.alias = {
      ...config.resolve.alias,
      pino: require.resolve('pino/browser'),
      lit: path.resolve(require.resolve('lit'), '../'),
      'porto': path.resolve(__dirname, 'src/stubs/porto/index.js'),
      'porto/internal': path.resolve(__dirname, 'src/stubs/porto/internal.js'),
      '@base-org/account': path.resolve(__dirname, 'src/stubs/porto/index.js'),
      '@noble/hashes': path.resolve(__dirname, '../../node_modules/@noble/hashes'),
      '@scure/bip32': path.resolve(__dirname, '../../node_modules/@scure/bip32'),
      '@scure/bip39': path.resolve(__dirname, '../../node_modules/@scure/bip39'),
      '@solana/errors': path.resolve(__dirname, 'src/stubs/solana-errors.js'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/stubs/react-native-async-storage.js'),
    };

    // Module replacement plugins
    config.plugins.push(
      new (require('webpack')).NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, '');
      })
    );

    // Fix @scure/bip32 importing 'bytes' from @noble/hashes/_assert (which doesn't exist in v1.8.0)
    config.plugins.push(
      new (require('webpack')).NormalModuleReplacementPlugin(
        /@noble\/hashes\/_assert/,
        (resource) => {
          resource.request = path.resolve(__dirname, 'src/stubs/noble-hashes-assert.js');
        }
      )
    );

    // Porto stub (if porto package is removed) — only match exact 'porto' not 'porto/internal'
    config.plugins.push(
      new (require('webpack')).NormalModuleReplacementPlugin(
        /^porto$/,
        (resource) => {
          resource.request = path.resolve(__dirname, 'src/stubs/porto/index.js');
        }
      )
    );

    // Stub porto/internal
    config.plugins.push(
      new (require('webpack')).NormalModuleReplacementPlugin(
        /^porto\/internal$/,
        (resource) => {
          resource.request = path.resolve(__dirname, 'src/stubs/porto/internal.js');
        }
      )
    );

    return config;
  },
};

module.exports = nextConfig;
