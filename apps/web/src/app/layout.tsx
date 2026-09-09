import '@fontsource-variable/inter';
import '@/styles/globals.css';

import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: {
    default: 'Jobbdjungeln — koll på hela ditt jobbsök',
    template: '%s · Jobbdjungeln',
  },
  description:
    'Samla sparade jobb, ansökningar, uppföljningar och din månadsrapport på ett ställe. Sök hela Platsbanken och se hur väl ditt CV matchar.',
  applicationName: 'Jobbdjungeln',
  authors: [{ name: 'Jobbdjungeln' }],
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    locale: 'sv_SE',
    siteName: 'Jobbdjungeln',
    title: 'Jobbdjungeln — koll på hela ditt jobbsök',
    description:
      'Samla sparade jobb, ansökningar, uppföljningar och din månadsrapport på ett ställe.',
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
      </body>
    </html>
  );
}
