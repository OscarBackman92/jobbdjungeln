'use client';

import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A group of rows under a heading.
 *
 * Collapsible, and lanes that hold nothing needing attention start collapsed —
 * the point of the boards is that what is urgent is the first thing you see.
 */
export function Lane({
  title,
  hint,
  count,
  tone = 'neutral',
  open,
  onOpenChange,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  tone?: 'neutral' | 'warning';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[var(--radius-card)] border bg-raised shadow-card',
        tone === 'warning' ? 'border-warning/35' : 'border-line',
      )}
    >
      <h2>
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          className={cn(
            'flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-hover',
            tone === 'warning' && 'bg-warning-soft/60',
          )}
        >
          <ChevronRight
            className={cn(
              'size-4 shrink-0 text-subtle transition-transform',
              open && 'rotate-90',
            )}
            aria-hidden
          />
          <span
            className={cn(
              'text-sm font-semibold',
              tone === 'warning' ? 'text-warning-text' : 'text-ink',
            )}
          >
            {title}
          </span>
          <span className="rounded-full bg-sunken px-1.5 text-[12px] font-medium text-muted tabular-nums">
            {count}
          </span>
          {hint ? <span className="ml-1 truncate text-[13px] text-subtle">{hint}</span> : null}
        </button>
      </h2>
      {open ? <ul className="border-t border-line">{children}</ul> : null}
    </section>
  );
}
