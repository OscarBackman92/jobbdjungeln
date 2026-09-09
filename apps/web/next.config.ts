import path from 'node:path';
import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Ships a self-contained server bundle, so the runtime image carries only the
  // dependencies actually reachable from the app.
  output: 'standalone',
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: [
    '@jobbdjungeln/core',
    '@jobbdjungeln/db',
    '@jobbdjungeln/jobtech',
    '@jobbdjungeln/resume',
  ],
  typedRoutes: true,
  // Development only: Next blocks its own dev resources when the browser uses a
  // different local hostname than the one the server thinks it has, which
  // silently breaks the client bundle for anything hitting 127.0.0.1.
  allowedDevOrigins: ['localhost', '127.0.0.1', '[::1]'],
  // The dev overlay's portal sits on top of the page and swallows clicks near
  // the corners, which an automated run cannot work around. Off for the e2e
  // suite, on for everyone else.
  devIndicators: process.env.NEXT_DEV_INDICATORS === 'off' ? false : undefined,
  poweredByHeader: false,
  experimental: {
    // Server Actions carry every mutation, so keep the body small enough that a
    // CV upload is the only large thing that ever gets posted.
    serverActions: { bodySizeLimit: '3mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
};

export default config;
