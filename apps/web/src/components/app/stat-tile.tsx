import type { LucideIcon } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * A headline number.
 *
 * A single value is a stat tile, never a one-bar chart. Tiles that point at
 * something needing attention are toned, the rest stay neutral — so a glance at
 * the row tells you whether anything is wrong.
 */
export function StatTile({
  label,
  value,
  hint,
  href,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: Route;
  icon?: LucideIcon;
  tone?: 'neutral' | 'warning' | 'positive';
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        {Icon ? <Icon className="size-4 shrink-0 text-subtle" aria-hidden /> : null}
      </div>
      <p
        className={cn(
          'mt-2 text-2xl font-semibold tracking-tight tabular-nums',
          tone === 'warning' ? 'text-warning-text' : 'text-ink',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[13px] text-subtle">{hint}</p> : null}
    </>
  );

  const className = cn(
    'block rounded-[var(--radius-card)] border p-4 shadow-card transition-colors',
    tone === 'warning' ? 'border-warning/30 bg-warning-soft' : 'border-line bg-raised',
    href && 'hover:border-line-strong',
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
