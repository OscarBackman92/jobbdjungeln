import Link from 'next/link';
import { ThemeToggle } from '@/components/app/theme-toggle';

/**
 * The signed-out shell.
 *
 * A single centred column with the value of the product stated once beside it on
 * a wide screen — someone signing in already knows what this is, and someone
 * signing up wants one sentence, not a pitch.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-4 py-4 lg:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink"
        >
          <span aria-hidden>🌿</span>
          Jobbdjungeln
        </Link>
        <ThemeToggle />
      </header>

      <main id="innehall" className="flex flex-1 items-start justify-center px-4 pt-6 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="px-4 pb-6 text-center text-[13px] text-subtle">
        <Link href="/integritet" className="hover:text-muted">
          Integritetspolicy
        </Link>
      </footer>
    </div>
  );
}
