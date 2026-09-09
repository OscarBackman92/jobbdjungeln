import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Workspace packages ship TypeScript source; Next compiles them with the app.
  transpilePackages: [
    '@jobbdjungeln/core',
    '@jobbdjungeln/db',
    '@jobbdjungeln/jobtech',
    '@jobbdjungeln/resume',
  ],
  typedRoutes: true,
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
