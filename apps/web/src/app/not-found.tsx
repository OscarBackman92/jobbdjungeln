import Link from 'next/link';
import { Button } from '@/components/ui';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-mono text-sm text-subtle">404</p>
      <h1 className="text-xl font-semibold tracking-tight text-ink">Sidan finns inte</h1>
      <p className="max-w-sm text-sm text-muted">
        Länken kan vara gammal, eller så har sidan bytt adress.
      </p>
      <Button variant="primary" asChild>
        <Link href="/">Till startsidan</Link>
      </Button>
    </div>
  );
}
