import { employerKey, roleKey } from './lifecycle.ts';

const TITLE_SIMILARITY = 0.55;

/** Dice coefficient on character bigrams — same idea as Python's SequenceMatcher. */
export function titlesSimilar(left: string, right: string): boolean {
  const a = roleKey(left);
  const b = roleKey(right);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  return bigramRatio(a, b) >= TITLE_SIMILARITY;
}

function bigrams(text: string): string[] {
  if (text.length < 2) return [text];
  const out: string[] = [];
  for (let index = 0; index < text.length - 1; index += 1) {
    out.push(text.slice(index, index + 2));
  }
  return out;
}

function bigramRatio(left: string, right: string): number {
  const a = bigrams(left);
  const b = bigrams(right);
  if (a.length === 0 || b.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const gram of a) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  let overlap = 0;
  for (const gram of b) {
    const remaining = counts.get(gram) ?? 0;
    if (remaining === 0) continue;
    counts.set(gram, remaining - 1);
    overlap += 1;
  }
  return (2 * overlap) / (a.length + b.length);
}

export interface SimilarCandidate {
  id: string;
  company: string;
  title: string;
  status: string;
  appliedAt: string | null;
  sourceJobId?: string;
  employerKey?: string;
}

/**
 * Notice-only duplicates: same JobTech id, or same employer with a similar title.
 * Never a hard block — the caller decides whether to warn or refuse.
 */
export function findSimilarRows(
  candidates: readonly SimilarCandidate[],
  query: { company: string; title: string; sourceJobId?: string; excludeId?: string },
  limit = 5,
): SimilarCandidate[] {
  const matches: SimilarCandidate[] = [];
  const seen = new Set<string>();
  const external = (query.sourceJobId ?? '').trim();

  if (external) {
    for (const row of candidates) {
      if (query.excludeId && row.id === query.excludeId) continue;
      if ((row.sourceJobId ?? '').trim() !== external) continue;
      seen.add(row.id);
      matches.push(row);
      if (matches.length >= limit) return matches;
    }
  }

  const key = employerKey(query.company);
  if (!key || !query.title.trim()) return matches;

  for (const row of candidates) {
    if (matches.length >= limit) break;
    if (query.excludeId && row.id === query.excludeId) continue;
    if (seen.has(row.id)) continue;
    const rowKey = row.employerKey ?? employerKey(row.company);
    if (rowKey !== key) continue;
    if (!titlesSimilar(query.title, row.title)) continue;
    seen.add(row.id);
    matches.push(row);
  }

  return matches;
}
