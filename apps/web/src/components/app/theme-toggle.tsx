'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';
import { migrateStoredTheme, type ThemeValue } from '@/lib/theme';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', label: 'Ljust', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Mörkt', icon: Moon },
] as const satisfies ReadonlyArray<{ value: ThemeValue; label: string; icon: typeof Sun }>;

/**
 * Light / system / dark.
 *
 * Built on real radio inputs rather than buttons carrying radio roles, so
 * arrow-key navigation, grouping and screen-reader announcements come from the
 * platform instead of being reimplemented.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const name = useId();

  useEffect(() => {
    setMounted(true);
    const migrated = migrateStoredTheme(theme);
    if (theme && theme !== migrated) setTheme(migrated);
  }, [theme, setTheme]);

  const selected: ThemeValue | null = mounted ? migrateStoredTheme(theme) : null;

  return (
    <fieldset className="inline-flex items-center gap-0.5 rounded-full bg-sunken p-0.5">
      <legend className="sr-only">Utseende</legend>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = selected === value;
        return (
          <label
            key={value}
            className={cn(
              'relative cursor-pointer rounded-full p-1.5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ring)]',
              active
                ? 'bg-brand-soft text-brand-text shadow-card'
                : 'text-subtle hover:bg-hover hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={active}
              onChange={() => setTheme(value)}
              aria-label={label}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
