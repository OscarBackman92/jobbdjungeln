'use client';

import { useEffect, useState } from 'react';

/**
 * Last-resort error UI when the root layout itself fails.
 *
 * Must render its own <html> and <body>. Cannot rely on shared providers or CSS
 * modules from the broken tree.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('[app] kritiskt fel', error);
  }, [error]);

  async function copyReference() {
    if (!error.digest) return;
    try {
      await navigator.clipboard.writeText(error.digest);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const mailBody = encodeURIComponent(
    `Hej,\n\nJag fick ett kritiskt fel i Jobbdjungeln.\nReferens: ${error.digest ?? '(saknas)'}\n`,
  );

  return (
    <html lang="sv">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '1rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#fbfbf9',
          color: '#1c1c18',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Något gick fel</h1>
        <p style={{ maxWidth: '24rem', margin: 0, fontSize: '0.875rem', color: '#6b6a63' }}>
          Felet är loggat. Ladda om sidan — dina uppgifter är oförändrade.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => {
              reset();
              window.location.assign('/');
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: 'none',
              background: '#1f6f52',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Försök igen
          </button>
          {error.digest ? (
            <button
              type="button"
              onClick={copyReference}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                border: '1px solid #d4d2c8',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              {copied ? 'Kopierad' : 'Kopiera referens'}
            </button>
          ) : null}
          <a
            href={`mailto:?subject=${encodeURIComponent('Fel i Jobbdjungeln')}&body=${mailBody}`}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #d4d2c8',
              background: '#fff',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            Mejla support
          </a>
        </div>
        {error.digest ? (
          <p style={{ margin: 0, fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: '#8a8880' }}>
            Referens: {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
