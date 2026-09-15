'use client';

import { X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import {
  Checkbox,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';

export interface MultiSelectOption {
  id: string;
  label: string;
}

export interface MultiSelectSection {
  id: string;
  label: string;
  options: readonly MultiSelectOption[];
}

/**
 * Searchable multi-select built on Radix Popover (no nested page scrollers).
 * Selected values render as chips; the list opens only while the field is active.
 */
export function MultiSelectCombobox({
  label,
  options = [],
  sections,
  selected,
  onChange,
  searchPlaceholder = 'Sök…',
  disabled = false,
  disabledPlaceholder = 'Välj ovan först',
  emptyHint = 'Inga alternativ',
  loading = false,
  className,
}: {
  label: string;
  options?: readonly MultiSelectOption[];
  /** When set, options are shown under section headings (e.g. kommuner per län). */
  sections?: readonly MultiSelectSection[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  searchPlaceholder?: string;
  disabled?: boolean;
  disabledPlaceholder?: string;
  emptyHint?: string;
  loading?: boolean;
  className?: string;
}) {
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const statusId = `${baseId}-status`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const flatOptions = useMemo(() => {
    if (sections?.length) return sections.flatMap((section) => section.options);
    return options;
  }, [options, sections]);

  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const option of flatOptions) map.set(option.id, option.label);
    return map;
  }, [flatOptions]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const filteredSections = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('sv');
    const matches = (option: MultiSelectOption) =>
      !needle || option.label.toLocaleLowerCase('sv').includes(needle);

    if (sections?.length) {
      return sections
        .map((section) => ({
          ...section,
          options: [...section.options].filter(matches).sort((a, b) => {
            const aSelected = selectedSet.has(a.id) ? 0 : 1;
            const bSelected = selectedSet.has(b.id) ? 0 : 1;
            if (aSelected !== bSelected) return aSelected - bSelected;
            return a.label.localeCompare(b.label, 'sv');
          }),
        }))
        .filter((section) => section.options.length > 0);
    }

    const sorted = [...options].filter(matches).sort((a, b) => {
      const aSelected = selectedSet.has(a.id) ? 0 : 1;
      const bSelected = selectedSet.has(b.id) ? 0 : 1;
      if (aSelected !== bSelected) return aSelected - bSelected;
      return a.label.localeCompare(b.label, 'sv');
    });

    return sorted.length ? [{ id: 'all', label: '', options: sorted }] : [];
  }, [options, query, sections, selectedSet]);

  const matchCount = filteredSections.reduce((sum, section) => sum + section.options.length, 0);

  function toggle(id: string) {
    if (disabled) return;
    if (selectedSet.has(id)) onChange(selected.filter((value) => value !== id));
    else onChange([...selected, id]);
  }

  function remove(id: string) {
    onChange(selected.filter((value) => value !== id));
  }

  if (disabled) {
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <Label>{label}</Label>
        <p className="rounded-[var(--radius-control)] border border-line bg-sunken px-3 py-2.5 text-[13px] text-subtle">
          {disabledPlaceholder}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={`${baseId}-search`}>{label}</Label>
        {selected.length > 0 ? (
          <button
            type="button"
            className="text-[12px] text-brand-text underline-offset-2 hover:underline"
            onClick={() => onChange([])}
          >
            Rensa ({selected.length})
          </button>
        ) : null}
      </div>

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={loading}
            className={cn(
              'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-[var(--radius-control)] border border-line-strong bg-raised px-2 py-1.5 text-left text-sm outline-none',
              'focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
            aria-haspopup="listbox"
            aria-expanded={open}
            aria-controls={listboxId}
          >
            {selected.length === 0 ? (
              <span className="px-1 text-subtle">
                {loading ? 'Laddar alternativ…' : searchPlaceholder}
              </span>
            ) : (
              selected.map((id) => {
                const chipLabel = labelById.get(id) ?? id;
                return (
                  <span
                    key={id}
                    className="inline-flex max-w-[12rem] items-center gap-1 rounded-full border border-line bg-sunken py-0.5 pr-0.5 pl-2 text-[12px]"
                  >
                    <span className="truncate">{chipLabel}</span>
                    <button
                      type="button"
                      className="inline-flex size-5 items-center justify-center rounded-full hover:bg-hover"
                      aria-label={`Ta bort ${chipLabel}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        remove(id);
                      }}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                );
              })
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            document.getElementById(`${baseId}-search`)?.focus();
          }}
        >
          <div className="border-b border-line p-2">
            <Input
              id={`${baseId}-search`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-describedby={statusId}
              autoComplete="off"
            />
            <p id={statusId} className="sr-only" aria-live="polite">
              {matchCount === 0
                ? 'Inga träffar'
                : `${matchCount} ${matchCount === 1 ? 'träff' : 'träffar'}`}
            </p>
          </div>
          <div
            id={listboxId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-56 overflow-y-auto overscroll-contain p-1.5"
          >
            {loading ? (
              <p className="px-2 py-3 text-[13px] text-subtle">Laddar alternativ…</p>
            ) : matchCount === 0 ? (
              <p className="px-2 py-3 text-[13px] text-subtle">{emptyHint}</p>
            ) : (
              filteredSections.map((section) => (
                <div key={section.id} className="mb-1">
                  {section.label ? (
                    <p className="px-2 py-1 text-[11px] font-medium tracking-wide text-subtle uppercase">
                      {section.label}
                    </p>
                  ) : null}
                  <ul className="m-0 list-none p-0">
                    {section.options.map((option) => {
                      const checked = selectedSet.has(option.id);
                      const optionId = `${baseId}-${option.id}`;
                      return (
                        <li key={option.id}>
                          <label
                            htmlFor={optionId}
                            className={cn(
                              'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
                              'hover:bg-hover',
                              checked && 'bg-brand-soft/60',
                            )}
                          >
                            <Checkbox
                              id={optionId}
                              checked={checked}
                              onCheckedChange={() => toggle(option.id)}
                              aria-label={option.label}
                            />
                            <span className="flex-1">
                              {option.label}
                              {checked ? <span className="sr-only">, vald</span> : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
