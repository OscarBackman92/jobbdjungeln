import Link from 'next/link';
import { MobileNav, SidebarNav } from '@/components/app/nav';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { UserMenu } from '@/components/app/user-menu';
import { requireUser } from '@/lib/session';
import { dashboard } from '@/server/queries/board';

/**
 * The signed-in shell.
 *
 * The guard lives here rather than in middleware, so every page below it is
 * authenticated by construction and no new route can be added unprotected.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const summary = await dashboard(user.id);

  // Counts on the tabs, but only for things that genuinely need doing.
  const badges = {
    '/sparade': summary.savedLanes.idag_imorgon,
    '/ansokningar': summary.waitingTooLong,
    '/rapport': summary.nextActions.length > 0 ? 0 : 0,
  } as const;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-raised px-3 py-4 lg:flex">
        <Link
          href="/oversikt"
          className="mb-6 flex items-center gap-2 px-2 text-[15px] font-semibold tracking-tight text-ink"
        >
          <span aria-hidden className="text-lg">
            🌿
          </span>
          Jobbdjungeln
        </Link>
        <SidebarNav badges={badges} />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur lg:px-6">
          <Link
            href="/oversikt"
            className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink lg:hidden"
          >
            <span aria-hidden>🌿</span>
            Jobbdjungeln
          </Link>
          <div className="ml-auto flex items-center gap-2">
            {/* One toggle for every screen size: two of them in the markup is
                duplicate UI, and duplicate controls for the same setting. */}
            <ThemeToggle />
            <UserMenu email={user.email} operatorId={user.operatorId} />
          </div>
        </header>

        <main id="innehall" className="flex-1 px-4 pt-5 pb-24 lg:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileNav badges={badges} />
    </div>
  );
}
