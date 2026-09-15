import type { SearchSort } from '@jobbdjungeln/jobtech';

/** Sort modes shown in the results toolbar (includes app-only CV sort). */
export const UI_SORTS = ['pubdate-desc', 'relevance', 'applydate-asc', 'cv-match'] as const;

export type UiSort = (typeof UI_SORTS)[number];

export interface SearchState {
  q: string;
  regions: string[];
  municipalities: string[];
  fields: string[];
  groups: string[];
  remote: boolean;
  sort: UiSort;
  publishedAfter: string;
  noExperience: boolean;
  /**
   * Show CV match badges in the UI. Stored as `cv=0` when off.
   * Does not control whether the API computes match (always on).
   */
  matchCv: boolean;
}

export const EMPTY_SEARCH: SearchState = {
  q: '',
  regions: [],
  municipalities: [],
  fields: [],
  groups: [],
  remote: false,
  sort: 'pubdate-desc',
  publishedAfter: '',
  noExperience: false,
  matchCv: true,
};

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

/** Panel draft vs applied — sort and CV visibility live outside the panel. */
export function samePanelFilters(a: SearchState, b: SearchState): boolean {
  return (
    a.q.trim() === b.q.trim() &&
    sameIds(a.regions, b.regions) &&
    sameIds(a.municipalities, b.municipalities) &&
    sameIds(a.fields, b.fields) &&
    sameIds(a.groups, b.groups) &&
    a.remote === b.remote &&
    a.publishedAfter === b.publishedAfter &&
    a.noExperience === b.noExperience
  );
}

/** @deprecated Prefer samePanelFilters for dirty checks. */
export function sameSearchState(a: SearchState, b: SearchState): boolean {
  return samePanelFilters(a, b) && a.sort === b.sort && a.matchCv === b.matchCv;
}

export function formatSwedishList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} och ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} och ${items[items.length - 1]}`;
}

/** Map UI sort to a JobTech sort (CV match is handled later in steg 7). */
export function toJobTechSort(sort: UiSort): SearchSort {
  if (sort === 'cv-match') return 'pubdate-desc';
  return sort;
}

export function parseUiSort(value: string | null): UiSort {
  if (value && (UI_SORTS as readonly string[]).includes(value)) return value as UiSort;
  return 'pubdate-desc';
}
