'use client';

import { fieldLabel, regionLabel } from '@jobbdjungeln/jobtech';
import type { SearchState } from '@/components/jobs/search-state';

const MAX_LABEL = 60;

/**
 * Default name for a saved search, built from the active filters.
 * Caps at 60 characters with an ellipsis when longer.
 */
export function suggestSavedSearchLabel(
  state: Pick<SearchState, 'q' | 'regions' | 'municipalities' | 'fields' | 'groups' | 'remote'>,
  labels?: {
    municipalities?: ReadonlyMap<string, string>;
    groups?: ReadonlyMap<string, string>;
  },
): string {
  const parts: string[] = [];
  const q = state.q.trim();
  if (q) parts.push(q);

  const places = (
    state.municipalities.length > 0
      ? state.municipalities.map((id) => labels?.municipalities?.get(id) ?? id)
      : state.regions.map((id) => regionLabel(id) || id)
  ).filter(Boolean);
  if (places.length) parts.push(places.join(', '));

  const fields = state.fields.map((id) => fieldLabel(id) || id).filter(Boolean);
  if (fields.length) {
    parts.push(fields.join(', '));
  } else {
    const groups = state.groups.map((id) => labels?.groups?.get(id) ?? id).filter(Boolean);
    if (groups.length) parts.push(groups.join(', '));
  }

  if (state.remote) parts.push('Distans');

  let label = parts.join(' · ') || 'Sparad sökning';
  if (label.length > MAX_LABEL) {
    label = `${label.slice(0, MAX_LABEL - 1)}…`;
  }
  return label;
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, index) => id === right[index]);
}

/** Whether the live filters match a saved search (ignoring sort). */
export function matchesSavedSearch(
  current: SearchState,
  search: {
    query: string;
    regions: string[];
    municipalities: string[];
    occupationFields: string[];
    occupationGroups: string[];
    remote: boolean;
    matchCv: boolean;
  },
): boolean {
  return (
    current.q === search.query &&
    sameIds(current.regions, search.regions) &&
    sameIds(current.municipalities, search.municipalities) &&
    sameIds(current.fields, search.occupationFields) &&
    sameIds(current.groups, search.occupationGroups) &&
    current.remote === search.remote &&
    current.matchCv === search.matchCv
  );
}

/** JobTech `published-after` from a saved-search run timestamp. */
export function lastRunToPublishedAfter(lastRunAt: string | Date | null | undefined): string {
  if (!lastRunAt) return '';
  const date = typeof lastRunAt === 'string' ? new Date(lastRunAt) : lastRunAt;
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().replace(/\.\d{3}Z$/, '');
}
