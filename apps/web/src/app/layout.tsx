import '@fontsource-variable/inter';
import '@/styles/globals.css';

import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from '@/components/providers';
import { env } from '@/lib/env';

/** Keep functions next to the Supabase DB in eu-north-1 (Stockholm). */
export const preferredRegion = 'arn1';

const appUrl = env().APP_URL;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Jobbdjungeln — koll på hela ditt jobbsök',
    template: '%s · Jobbdjungeln',
  },
  description:
    'Samla sparade jobb, ansökningar, uppföljningar och din månadsrapport på ett ställe. Sök hela Platsbanken och se hur väl ditt CV matchar.',
  applicationName: 'Jobbdjungeln',
  authors: [{ name: 'Jobbdjungeln' }],
  formatDetection: { telephone: false },
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'sv_SE',
    url: appUrl,
    siteName: 'Jobbdjungeln',
    title: 'Jobbdjungeln — koll på hela ditt jobbsök',
    description:
      'Samla sparade jobb, ansökningar, uppföljningar och din månadsrapport på ett ställe.',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Jobbdjungeln' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Jobbdjungeln — koll på hela ditt jobbsök',
    description:
      'Samla sparade jobb, ansökningar, uppföljningar och din månadsrapport på ett ställe.',
    images: ['/opengraph-image'],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbf9' },
    { media: '(prefers-color-scheme: dark)', color: '#1c1d20' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <body>
        <a href="#innehall" className="skip-link">
          Hoppa till innehållet
        </a>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
