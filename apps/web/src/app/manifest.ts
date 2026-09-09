import type { MetadataRoute } from 'next';

/** Installable as a home-screen app: a job hunt is largely done on a phone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Jobbdjungeln',
    short_name: 'Jobbdjungeln',
    description: 'Koll på hela ditt jobbsök — sparade jobb, ansökningar och månadsrapporten.',
    start_url: '/oversikt',
    display: 'standalone',
    background_color: '#fbfbf9',
    theme_color: '#1f6f52',
    lang: 'sv-SE',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
