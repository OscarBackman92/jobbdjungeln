import { canonicalSkillLabel } from './skills.ts';
import { gotReply, type Status } from './statuses.ts';

export interface InsightGap {
  term: string;
  level: string;
  count: number;
  share: number;
}

export interface InsightHit {
  term: string;
  count: number;
  share: number;
}

export interface InsightBand {
  band: string;
  tracked: number;
  responded: number;
  rate: number | null;
  insufficientData: boolean;
}

export interface SkillInsights {
  gapTerms: InsightGap[];
  hitTerms: InsightHit[];
  unusedTerms: Array<{ term: string }>;
  responseByBand: InsightBand[];
  scope: {
    applications: number;
    withSnapshot: number;
    since: string | null;
    hint: string | null;
  };
}

export interface InsightRow {
  status: Status;
  archived: boolean;
  matchScore: number | null;
  matchScoredAt: string | null;
  matchSnapshot: {
    mustTotal?: number;
    meritTotal?: number;
    gaps?: Array<{ term?: string; level?: string }>;
    covered?: Array<{ term?: string }>;
    unusedCvTerms?: string[];
  } | null;
}

const BANDS: ReadonlyArray<{ label: string; low: number; high: number }> = [
  { label: '0-39', low: 0, high: 39 },
  { label: '40-69', low: 40, high: 69 },
  { label: '70-100', low: 70, high: 100 },
];

const MIN_BAND = 5;

function countMapIncrement(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function bandEntry(label: string, rows: readonly InsightRow[]): InsightBand {
  const tracked = rows.length;
  const responded = rows.filter((row) => gotReply(row.status)).length;
  const enough = tracked >= MIN_BAND;
  return {
    band: label,
    tracked,
    responded,
    rate: enough ? Math.round((responded / tracked) * 1000) / 1000 : null,
    insufficientData: !enough,
  };
}

/**
 * Aggregate skill gaps/hits from stored match snapshots.
 *
 * Owned terms (already on the CV) are filtered out of the gap list so the
 * panel only offers things the user can still add.
 */
export function buildSkillInsights(
  rows: readonly InsightRow[],
  ownedSkills: readonly string[] = [],
): SkillInsights {
  const live = rows.filter((row) => !row.archived);
  const scored = live.filter((row) => row.matchSnapshot && row.matchScoredAt);
  const owned = new Set(
    ownedSkills.map((term) => canonicalSkillLabel(term).toLowerCase()).filter(Boolean),
  );

  const gapCounter = new Map<string, number>();
  const gapLevel = new Map<string, string>();
  const hitCounter = new Map<string, number>();
  const unusedCounter = new Map<string, number>();
  let earliest: string | null = null;

  for (const row of scored) {
    const snap = row.matchSnapshot;
    if (!snap) continue;
    if (row.matchScoredAt && (earliest === null || row.matchScoredAt < earliest)) {
      earliest = row.matchScoredAt;
    }
    for (const gap of snap.gaps ?? []) {
      const term = gap.term?.trim();
      if (!term) continue;
      countMapIncrement(gapCounter, term);
      if (gap.level === 'must' || !gapLevel.has(term)) {
        gapLevel.set(term, gap.level ?? 'must');
      }
    }
    for (const covered of snap.covered ?? []) {
      const term = covered.term?.trim();
      if (term) countMapIncrement(hitCounter, term);
    }
    for (const term of snap.unusedCvTerms ?? []) {
      if (term) countMapIncrement(unusedCounter, term);
    }
  }

  const total = Math.max(scored.length, 1);
  const gapTerms = [...gapCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([term]) => !owned.has(canonicalSkillLabel(term).toLowerCase()))
    .slice(0, 12)
    .map(([term, count]) => ({
      term,
      level: gapLevel.get(term) ?? 'must',
      count,
      share: Math.round((count / total) * 1000) / 1000,
    }));

  const hitTerms = [...hitCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([term, count]) => ({
      term,
      count,
      share: Math.round((count / total) * 1000) / 1000,
    }));

  const unusedTerms = [...unusedCounter.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([term]) => !hitCounter.has(term))
    .slice(0, 12)
    .map(([term]) => ({ term }));

  const responseByBand = BANDS.map((band) =>
    bandEntry(
      band.label,
      scored.filter(
        (row) =>
          row.matchScore !== null && row.matchScore >= band.low && row.matchScore <= band.high,
      ),
    ),
  );
  responseByBand.push(
    bandEntry(
      'ej bedömd',
      scored.filter((row) => row.matchScore === null),
    ),
  );

  return {
    gapTerms,
    hitTerms,
    unusedTerms,
    responseByBand,
    scope: {
      applications: live.length,
      withSnapshot: scored.length,
      since: earliest ? earliest.slice(0, 10) : null,
      hint:
        scored.length === 0
          ? 'Inga matchningssnapshots sparade ännu. Spara eller markera jobb som sökta.'
          : null,
    },
  };
}
