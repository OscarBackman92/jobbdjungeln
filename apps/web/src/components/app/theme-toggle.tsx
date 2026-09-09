'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useId, useState } from 'react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'light', label: 'Ljust', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'dark', label: 'Mörkt', icon: Moon },
] as const;

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

  // The server cannot know the visitor's theme, so nothing is marked as chosen
  // until the client has read it — otherwise the markup would not match.
  useEffect(() => setMounted(true), []);

  return (
    <fieldset className="inline-flex items-center gap-0.5 rounded-full bg-sunken p-0.5">
      <legend className="sr-only">Utseende</legend>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <label
            key={value}
            className={cn(
              'cursor-pointer rounded-full p-1.5 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--ring)]',
              active ? 'bg-raised text-ink shadow-card' : 'text-subtle hover:text-ink',
            )}
          >
            <input
              type="radio"
              name={name}
              value={value}
              checked={active}
              onChange={() => setTheme(value)}
              className="sr-only"
            />
            <Icon className="size-3.5" aria-hidden />
            <span className="sr-only">{label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
