import type { SearchSort } from '@jobbdjungeln/jobtech';

export interface SearchState {
  q: string;
  regions: string[];
  municipalities: string[];
  fields: string[];
  groups: string[];
  remote: boolean;
  sort: SearchSort;
  publishedAfter: string;
  noExperience: boolean;
  /** Default on. `cv=0` in the URL turns CV matching off. */
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

/** True when panel draft and URL-applied filters describe the same search. */
export function sameSearchState(a: SearchState, b: SearchState): boolean {
  return (
    a.q.trim() === b.q.trim() &&
    sameIds(a.regions, b.regions) &&
    sameIds(a.municipalities, b.municipalities) &&
    sameIds(a.fields, b.fields) &&
    sameIds(a.groups, b.groups) &&
    a.remote === b.remote &&
    a.sort === b.sort &&
    a.publishedAfter === b.publishedAfter &&
    a.noExperience === b.noExperience &&
    a.matchCv === b.matchCv
  );
}

export function formatSwedishList(items: readonly string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} och ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} och ${items[items.length - 1]}`;
}
