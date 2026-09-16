'use client';

import { pluralWord } from '@jobbdjungeln/core';
import {
  Bookmark,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MoreHorizontal,
  Search,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from '@/components/app/theme-toggle';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

export interface NavItem {
  href: '/oversikt' | '/sparade' | '/ansokningar' | '/annonser' | '/rapport' | '/profil';
  label: string;
  icon: LucideIcon;
  /** Shown as a count on the tab — only for things that need attention. */
  badge?: number;
}

export const NAV_ITEMS: readonly Omit<NavItem, 'badge'>[] = [
  { href: '/oversikt', label: 'Översikt', icon: LayoutDashboard },
  { href: '/sparade', label: 'Sparade', icon: Bookmark },
  { href: '/ansokningar', label: 'Ansökningar', icon: Send },
  { href: '/annonser', label: 'Annonser', icon: Search },
  { href: '/rapport', label: 'Rapport', icon: ClipboardList },
  { href: '/profil', label: 'Profil', icon: UserRound },
];

const MOBILE_PRIMARY: readonly Omit<NavItem, 'badge'>[] = [
  { href: '/oversikt', label: 'Översikt', icon: LayoutDashboard },
  { href: '/annonser', label: 'Annonser', icon: Search },
  { href: '/sparade', label: 'Sparade', icon: Bookmark },
  { href: '/ansokningar', label: 'Ansökningar', icon: Send },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

/** The sidebar shown from `lg` up. */
export function SidebarNav({ badges }: { badges?: Partial<Record<NavItem['href'], number>> }) {
  const isActive = useIsActive();

  return (
    <nav aria-label="Huvudmeny" className="flex flex-col gap-0.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(href);
        const badge = badges?.[href];
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            aria-label={
              href === '/sparade' && badge
                ? `${label}, ${badge} ${pluralWord(badge, 'sparat jobb', 'sparade jobb')} har sista dag idag eller imorgon`
                : undefined
            }
            className={cn(
              'group flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-brand-soft text-brand-text'
                : 'text-muted hover:bg-hover hover:text-ink',
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{label}</span>
            {badge ? (
              <span
                className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning-text"
                title={
                  href === '/sparade'
                    ? `${badge} ${pluralWord(badge, 'sparat jobb', 'sparade jobb')} har sista dag idag eller imorgon`
                    : undefined
                }
              >
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The bottom bar on a phone — five tabs, with Rapport/Profil/tema/utloggning
 * under Mer so labels stay readable at 375 px.
 */
export function MobileNav({ badges }: { badges?: Partial<Record<NavItem['href'], number>> }) {
  const isActive = useIsActive();
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const moreActive =
    pathname.startsWith('/rapport') || pathname.startsWith('/profil') || moreOpen;

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <>
      <nav
        aria-label="Huvudmeny"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-5">
          {MOBILE_PRIMARY.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            const badge = badges?.[href];
            return (
              <li key={href}>
                <Link
                  href={href}
                  prefetch={false}
                  aria-current={active ? 'page' : undefined}
                  aria-label={
                    href === '/sparade' && badge
                      ? `${label}, ${badge} ${pluralWord(badge, 'sparat jobb', 'sparade jobb')} har sista dag idag eller imorgon`
                      : badge
                        ? `${label}, ${badge} behöver uppmärksamhet`
                        : undefined
                  }
                  className={cn(
                    'relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[12px] leading-tight font-medium transition-colors',
                    active ? 'text-brand-text' : 'text-subtle',
                  )}
                >
                  {active ? (
                    <span
                      className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand"
                      aria-hidden
                    />
                  ) : null}
                  <span className="relative">
                    <Icon className="size-6" aria-hidden />
                    {badge ? (
                      <span
                        className="absolute -top-1 -right-2 min-w-4 rounded-full bg-warning px-1 text-[10px] leading-4 font-semibold text-white"
                        title={
                          href === '/sparade'
                            ? `${badge} ${pluralWord(badge, 'sparat jobb', 'sparade jobb')} har sista dag idag eller imorgon`
                            : undefined
                        }
                        aria-hidden
                      >
                        {badge}
                      </span>
                    ) : null}
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-controls="mobile-more-sheet"
              onClick={() => setMoreOpen(true)}
              className={cn(
                'relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[12px] leading-tight font-medium transition-colors',
                moreActive ? 'text-brand-text' : 'text-subtle',
              )}
            >
              {moreActive ? (
                <span
                  className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-brand"
                  aria-hidden
                />
              ) : null}
              <MoreHorizontal className="size-6" aria-hidden />
              Mer
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Stäng mer-menyn"
            onClick={() => setMoreOpen(false)}
          />
          <div
            id="mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Mer"
            className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border border-line bg-raised pb-[env(safe-area-inset-bottom)] shadow-overlay"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-sm font-semibold text-ink">Mer</p>
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-md text-subtle hover:bg-hover hover:text-ink"
                aria-label="Stäng"
                onClick={() => setMoreOpen(false)}
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <ul className="flex flex-col p-2">
              <li>
                <Link
                  href="/rapport"
                  prefetch={false}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink hover:bg-hover"
                  onClick={() => setMoreOpen(false)}
                >
                  <ClipboardList className="size-5 text-subtle" aria-hidden />
                  Rapport
                </Link>
              </li>
              <li>
                <Link
                  href="/profil"
                  prefetch={false}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink hover:bg-hover"
                  onClick={() => setMoreOpen(false)}
                >
                  <UserRound className="size-5 text-subtle" aria-hidden />
                  Profil
                </Link>
              </li>
            </ul>
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
              <span className="text-sm text-muted">Utseende</span>
              <ThemeToggle />
            </div>
            <div className="border-t border-line p-2">
              <button
                type="button"
                className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-ink hover:bg-hover"
                onClick={() => void handleSignOut()}
              >
                <LogOut className="size-5 text-subtle" aria-hidden />
                {signingOut ? 'Loggar ut…' : 'Logga ut'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
