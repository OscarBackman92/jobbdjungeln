'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui';

/**
 * The last line of defence.
 *
 * It never shows the raw error: a stack trace tells a user nothing and can leak
 * internals. The digest is shown instead, so a support conversation has
 * something to match against the server log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] oväntat fel', error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight text-ink">Något gick fel</h1>
      <p className="max-w-sm text-sm text-muted">
        Felet är loggat. Prova igen — dina uppgifter är oförändrade.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={reset}>
          Försök igen
        </Button>
        <Button variant="secondary" asChild>
          <a href="/oversikt">Till översikten</a>
        </Button>
      </div>
      {error.digest ? (
        <p className="font-mono text-xs text-subtle">Referens: {error.digest}</p>
      ) : null}
    </div>
  );
}
