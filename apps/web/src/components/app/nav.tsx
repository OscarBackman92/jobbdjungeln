'use client';

import {
  Bookmark,
  ClipboardList,
  LayoutDashboard,
  type LucideIcon,
  Search,
  Send,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
            aria-current={active ? 'page' : undefined}
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
              <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[11px] font-semibold text-warning-text">
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
 * The bottom bar on a phone.
 *
 * Five destinations at thumb height, with the safe-area inset respected so the
 * last row is not hidden behind the home indicator.
 */
export function MobileNav({ badges }: { badges?: Partial<Record<NavItem['href'], number>> }) {
  const isActive = useIsActive();

  return (
    <nav
      aria-label="Huvudmeny"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-raised/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.filter((item) => item.href !== '/profil').map(
          ({ href, label, icon: Icon }) => {
            const active = isActive(href);
            const badge = badges?.[href];
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors',
                    active ? 'text-brand-text' : 'text-subtle',
                  )}
                >
                  <span className="relative">
                    <Icon className="size-5" aria-hidden />
                    {badge ? (
                      <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-warning px-1 text-[10px] leading-4 font-semibold text-white">
                        {badge}
                        <span className="sr-only"> behöver uppmärksamhet</span>
                      </span>
                    ) : null}
                  </span>
                  {label}
                </Link>
              </li>
            );
          },
        )}
      </ul>
    </nav>
  );
}
