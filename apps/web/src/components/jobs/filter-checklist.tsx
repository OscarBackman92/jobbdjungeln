'use client';

import { useId } from 'react';
import { Checkbox } from '@/components/ui';
import { cn } from '@/lib/utils';

export interface ChecklistOption {
  id: string;
  label: string;
}

/**
 * Multi-select list for search filters.
 *
 * Radix Select is single-value and awkward on phones once options load async;
 * a scrollable checklist lets the user pick several kommuner / yrkesområden
 * without losing the parent län or fighting the mobile bottom nav.
 */
export function FilterChecklist({
  label,
  options,
  selected,
  onChange,
  disabled = false,
  disabledHint,
  loading = false,
  emptyHint,
  className,
}: {
  label: string;
  options: readonly ChecklistOption[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  disabledHint?: string;
  loading?: boolean;
  emptyHint?: string;
  className?: string;
}) {
  const baseId = useId();
  const selectedSet = new Set(selected);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedSet.has(id)) onChange(selected.filter((value) => value !== id));
    else onChange([...selected, id]);
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {selected.length > 0 ? (
          <button
            type="button"
            className="text-[12px] text-brand-text underline-offset-2 hover:underline disabled:opacity-50"
            disabled={disabled}
            onClick={() => onChange([])}
          >
            Rensa ({selected.length})
          </button>
        ) : null}
      </div>

      {disabled ? (
        <p className="rounded-[var(--radius-control)] border border-dashed border-line px-3 py-3 text-[13px] text-subtle">
          {disabledHint ?? 'Välj ovan först'}
        </p>
      ) : loading ? (
        <p className="rounded-[var(--radius-control)] border border-line px-3 py-3 text-[13px] text-subtle">
          Laddar alternativ…
        </p>
      ) : options.length === 0 ? (
        <p className="rounded-[var(--radius-control)] border border-dashed border-line px-3 py-3 text-[13px] text-subtle">
          {emptyHint ?? 'Inga alternativ'}
        </p>
      ) : (
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="sr-only">{label}</legend>
          <ul className="scrollbar-slim max-h-44 space-y-0.5 overflow-y-auto overscroll-contain rounded-[var(--radius-control)] border border-line bg-sunken p-1.5">
            {options.map((option) => {
              const inputId = `${baseId}-${option.id}`;
              const checked = selectedSet.has(option.id);
              return (
                <li key={option.id}>
                  <label
                    htmlFor={inputId}
                    className={cn(
                      'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink',
                      'hover:bg-hover active:bg-hover',
                      checked && 'bg-brand-soft/60',
                    )}
                  >
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      onCheckedChange={() => toggle(option.id)}
                    />
                    <span className="flex-1">{option.label}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}
    </div>
  );
}
