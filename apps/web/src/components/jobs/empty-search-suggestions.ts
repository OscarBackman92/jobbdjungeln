import { buildActiveFilterChips, type FilterChip } from '@/components/jobs/active-filter-chips';
import type { SearchState } from '@/components/jobs/search-state';

export const MAX_RELAXATION_COUNTS = 6;

export interface SearchRelaxation {
  id: string;
  /** e.g. "Utan Järfälla" */
  withoutLabel: string;
  /** e.g. "Ta bort Järfälla" */
  removeButton: string;
  next: SearchState;
}

/** One-filter removals to probe when the current search returns 0 hits. */
export function buildSearchRelaxations(
  state: SearchState,
  labels: {
    municipalities: ReadonlyMap<string, string>;
    groups: ReadonlyMap<string, string>;
    groupFields: ReadonlyMap<string, string>;
  },
  max = MAX_RELAXATION_COUNTS,
): SearchRelaxation[] {
  return buildActiveFilterChips(state, labels)
    .slice(0, max)
    .map((chip: FilterChip) => ({
      id: chip.key,
      withoutLabel: `Utan ${chip.label}`,
      removeButton: `Ta bort ${chip.label}`,
      next: chip.remove(state),
    }));
}
