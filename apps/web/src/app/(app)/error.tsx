'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui';

/**
 * Route-level error inside the signed-in shell.
 *
 * Lives under `(app)/layout`, so the sidebar and header stay. Client error
 * boundaries cannot force HTTP 500; server throws during SSR still do.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error('[app] oväntat fel', error);
  }, [error]);

  function retry() {
    window.location.assign(pathname || '/oversikt');
  }

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
    `Hej,\n\nJag fick ett fel i Jobbdjungeln.\nReferens: ${error.digest ?? '(saknas)'}\nSida: ${pathname}\n`,
  );

  return (
    <div className="flex flex-col items-start gap-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Något gick fel</h1>
      <p className="max-w-md text-sm text-muted">
        Felet är loggat. Prova igen — dina uppgifter är oförändrade.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            reset();
            retry();
          }}
        >
          Försök igen
        </Button>
        <Button variant="secondary" asChild>
          <a href="/oversikt">Till översikten</a>
        </Button>
        {error.digest ? (
          <Button variant="ghost" onClick={copyReference}>
            {copied ? 'Kopierad' : 'Kopiera referens'}
          </Button>
        ) : null}
        <Button variant="ghost" asChild>
          <a href={`mailto:?subject=${encodeURIComponent('Fel i Jobbdjungeln')}&body=${mailBody}`}>
            Mejla support
          </a>
        </Button>
      </div>
      {error.digest ? (
        <p className="font-mono text-xs text-subtle">Referens: {error.digest}</p>
      ) : null}
    </div>
  );
}
