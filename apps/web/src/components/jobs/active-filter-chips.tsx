'use client';

import { fieldLabel, regionLabel } from '@jobbdjungeln/jobtech';
import { X } from 'lucide-react';
import type { SearchState } from '@/components/jobs/search-state';
import { cn } from '@/lib/utils';

export interface FilterChip {
  key: string;
  label: string;
  /** Remove this chip from the applied search state. */
  remove: (state: SearchState) => SearchState;
}

const PUBLISHED_LABELS: Record<string, string> = {
  [String(24 * 60)]: 'Senaste 24 timmarna',
  [String(7 * 24 * 60)]: 'Senaste 7 dagarna',
  [String(30 * 24 * 60)]: 'Senaste 30 dagarna',
};

/** Active filters from applied URL state, in the order chips should appear. */
export function buildActiveFilterChips(
  state: SearchState,
  labels: {
    municipalities: ReadonlyMap<string, string>;
    groups: ReadonlyMap<string, string>;
    /** groupId → occupation field id */
    groupFields: ReadonlyMap<string, string>;
  },
): FilterChip[] {
  const chips: FilterChip[] = [];

  if (state.q.trim()) {
    const q = state.q.trim();
    chips.push({
      key: `q:${q}`,
      label: q,
      remove: (next) => ({ ...next, q: '' }),
    });
  }

  for (const id of state.regions) {
    chips.push({
      key: `region:${id}`,
      label: regionLabel(id) || id,
      remove: (next) => ({
        ...next,
        regions: next.regions.filter((value) => value !== id),
      }),
    });
  }

  for (const id of state.municipalities) {
    chips.push({
      key: `kommun:${id}`,
      label: labels.municipalities.get(id) ?? id,
      remove: (next) => ({
        ...next,
        municipalities: next.municipalities.filter((value) => value !== id),
      }),
    });
  }

  for (const id of state.fields) {
    chips.push({
      key: `omrade:${id}`,
      label: fieldLabel(id) || id,
      remove: (next) => {
        const fields = next.fields.filter((value) => value !== id);
        const groups =
          fields.length === 0
            ? []
            : next.groups.filter((groupId) => labels.groupFields.get(groupId) !== id);
        return { ...next, fields, groups };
      },
    });
  }

  for (const id of state.groups) {
    chips.push({
      key: `yrkesgrupp:${id}`,
      label: labels.groups.get(id) ?? id,
      remove: (next) => ({
        ...next,
        groups: next.groups.filter((value) => value !== id),
      }),
    });
  }

  if (state.publishedAfter) {
    chips.push({
      key: `publicerad:${state.publishedAfter}`,
      label: PUBLISHED_LABELS[state.publishedAfter] ?? `Publicerad ${state.publishedAfter}`,
      remove: (next) => ({ ...next, publishedAfter: '' }),
    });
  }

  if (state.remote) {
    chips.push({
      key: 'distans',
      label: 'Distans',
      remove: (next) => ({ ...next, remote: false }),
    });
  }

  if (state.noExperience) {
    chips.push({
      key: 'erfarenhet',
      label: 'Utan erfarenhet',
      remove: (next) => ({ ...next, noExperience: false }),
    });
  }

  return chips;
}

/** Number of active filters excluding the search phrase (for the Filter button). */
export function countActiveFiltersExcludingQuery(state: SearchState): number {
  return (
    state.regions.length +
    state.municipalities.length +
    state.fields.length +
    state.groups.length +
    (state.publishedAfter ? 1 : 0) +
    (state.remote ? 1 : 0) +
    (state.noExperience ? 1 : 0)
  );
}

const MAX_VISIBLE = 5;

export function ActiveFilterChips({
  chips,
  onRemove,
  onClearAll,
  onExpand,
  className,
}: {
  chips: readonly FilterChip[];
  onRemove: (chip: FilterChip) => void;
  onClearAll: () => void;
  onExpand: () => void;
  className?: string;
}) {
  if (chips.length === 0) return null;

  const overflow = chips.length > 6;
  const visible = overflow ? chips.slice(0, MAX_VISIBLE) : chips;
  const hiddenCount = overflow ? chips.length - MAX_VISIBLE : 0;

  return (
    <ul
      className={cn(
        'm-0 flex list-none items-center gap-2 p-0',
        'max-sm:-mx-1 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:px-1 max-sm:pb-1',
        'sm:flex-wrap',
        className,
      )}
      aria-label="Aktiva filter"
    >
      {visible.map((chip) => (
        <li
          key={chip.key}
          className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-line bg-sunken py-1 pr-1 pl-2.5 text-[13px] text-ink"
        >
          <span className="truncate">{chip.label}</span>
          <button
            type="button"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:size-6"
            aria-label={`Ta bort filter: ${chip.label}`}
            onClick={() => onRemove(chip)}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </li>
      ))}
      {hiddenCount > 0 ? (
        <li className="shrink-0">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-raised px-3 text-[13px] font-medium text-brand-text hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:h-8 sm:min-h-0 sm:px-2.5"
            onClick={onExpand}
          >
            +{hiddenCount} till
          </button>
        </li>
      ) : null}
      <li className="shrink-0">
        <button
          type="button"
          className="inline-flex min-h-11 items-center px-2 text-[13px] font-medium text-brand-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand sm:min-h-0 sm:px-0"
          onClick={onClearAll}
        >
          Rensa alla
        </button>
      </li>
    </ul>
  );
}
