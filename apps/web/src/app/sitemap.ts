import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env().APP_URL;
  const now = new Date();

  return [
    { url: base, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/om`, lastModified: now, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${base}/faq`, lastModified: now, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/integritet`, lastModified: now, changeFrequency: 'yearly', priority: 0.4 },
  ];
}
