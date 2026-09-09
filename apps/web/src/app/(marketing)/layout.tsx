import Link from 'next/link';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { Button } from '@/components/ui';
import { currentUser } from '@/lib/session';

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between gap-3 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink"
          >
            <span aria-hidden>🌿</span>
            Jobbdjungeln
          </Link>
          <nav aria-label="Sidfotsmeny" className="flex items-center gap-1">
            <Link
              href="/om"
              className="rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-hover hover:text-ink"
            >
              Om
            </Link>
            <Link
              href="/integritet"
              className="hidden rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-hover hover:text-ink sm:block"
            >
              Integritet
            </Link>
            <ThemeToggle />
            <Button size="sm" variant="primary" asChild className="ml-1">
              <Link href={user ? '/oversikt' : '/logga-in'}>
                {user ? 'Öppna appen' : 'Logga in'}
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <main id="innehall" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        {children}
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-6 text-[13px] text-subtle">
          <span>© {new Date().getFullYear()} Jobbdjungeln</span>
          <Link href="/om" className="hover:text-muted">
            Om tjänsten
          </Link>
          <Link href="/integritet" className="hover:text-muted">
            Integritetspolicy
          </Link>
          <Link href="/faq" className="hover:text-muted">
            Vanliga frågor
          </Link>
        </div>
      </footer>
    </div>
  );
}
