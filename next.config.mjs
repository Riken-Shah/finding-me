import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';

// Setup dev platform
if (process.env.NODE_ENV === 'development') {
  (async () => { await setupDevPlatform(); })();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/api/analytics/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, max-age=0',
          },
        ],
      },
    ];
  },
};

export default nextConfig; 