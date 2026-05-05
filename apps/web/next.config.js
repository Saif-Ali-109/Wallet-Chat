const webpack = require('webpack');
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'export',

  images: {
    unoptimized: true,
  },
  transpilePackages: [
    'lucide-react',
  ],
  webpack: (config, { isServer }) => {
    // KEY FIX: Add apps/web/node_modules to module resolution paths.
    // Root-level packages (wagmi, @wagmi/connectors) can't find their peer deps
    // that are installed locally in apps/web/node_modules. This tells webpack to
    // always check both locations, fixing all "Module not found" errors at once.
    config.resolve.modules = [
      path.resolve(__dirname, 'node_modules'),       // apps/web/node_modules first
      path.resolve(__dirname, '../../node_modules'), // monorepo root node_modules
      'node_modules',
    ];

    config.resolve.alias = {
      ...config.resolve.alias,
      pino: require.resolve('pino/browser'),
      lit: path.resolve(require.resolve('lit'), '../'),
      porto: path.resolve(__dirname, 'src/stubs/porto'),
      '@noble/hashes': path.resolve(__dirname, '../../node_modules/@noble/hashes'),
      '@scure/bip32': path.resolve(__dirname, '../../node_modules/@scure/bip32'),
      '@scure/bip39': path.resolve(__dirname, '../../node_modules/@scure/bip39'),
      '@solana/errors': path.resolve(__dirname, 'src/stubs/solana-errors.js'),
    };

    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
        resource.request = resource.request.replace(/^node:/, '');
      })
    );

    // Fix @scure/bip32 importing 'bytes' from @noble/hashes/_assert (which doesn't exist in v1.8.0)
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /@noble\/hashes\/_assert/,
        (resource) => {
          resource.request = path.resolve(__dirname, 'src/stubs/noble-hashes-assert.js');
        }
      )
    );

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
        new webpack.ProvidePlugin({
          process: 'process/browser',
          Buffer: ['buffer', 'Buffer'],
        })
      );
    }

    return config;
  },
}

module.exports = nextConfig
