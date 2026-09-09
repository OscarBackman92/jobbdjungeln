import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Empty states.
 *
 * An empty screen is where most people give up, so each one says what the screen
 * is for and offers the single next action rather than just reporting nothing.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong px-6 py-12 text-center',
        className,
      )}
    >
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-sunken text-subtle">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** A loading placeholder shaped like the content it replaces. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-sunken', className)} aria-hidden />;
}

export function ErrorNote({
  title = 'Något gick fel',
  description,
  action,
}: {
  title?: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-danger/30 bg-danger-soft px-4 py-3"
    >
      <p className="text-sm font-medium text-danger-text">{title}</p>
      {description ? <p className="text-sm text-danger-text/90">{description}</p> : null}
      {action}
    </div>
  );
}

/** Announces a change to assistive technology without showing anything. */
export function LiveRegion({ children }: { children: ReactNode }) {
  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {children}
    </div>
  );
}
