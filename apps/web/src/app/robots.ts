import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Nothing behind the sign-in has any business in an index.
      disallow: [
        '/oversikt',
        '/sparade',
        '/ansokningar',
        '/annonser',
        '/rapport',
        '/profil',
        '/api/',
      ],
    },
    sitemap: `${env().APP_URL}/sitemap.xml`,
  };
}
