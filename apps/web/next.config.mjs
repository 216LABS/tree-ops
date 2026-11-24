import { buildCsp } from './csp.mjs';

const prod = (process.env.APP_ENV ?? (process.env.VERCEL_ENV === 'production' ? 'production' : 'local')) === 'production';
const csp = buildCsp({ prod, supabase: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '' });

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@treeops/core', '@treeops/db', '@treeops/providers', '@treeops/ui'],
  serverExternalPackages: ['@react-pdf/renderer', 'postgres', 'exifr'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
        ],
      },
      // Signed tokens live in these URLs; never leak them in a Referer header or a search index.
      ...['/c/:path*', '/e/:path*', '/co/:path*', '/i/:path*', '/r/:path*', '/v/:path*'].map((source) => ({
        source,
        headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'X-Robots-Tag', value: 'noindex' }],
      })),
      { source: '/sw.js', headers: [{ key: 'Service-Worker-Allowed', value: '/' }, { key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default nextConfig;
