import type { MatchSnapshot } from '@jobbdjungeln/core';
import type { BadgeTone } from '@/components/ui';

export interface MatchBadgeView {
  label: string;
  tone: BadgeTone;
  /** Dashed border when the ad lists few requirements. */
  uncertain: boolean;
  tooltip: string | null;
}

/** Pure presentation rules for CV match badges (no "Match oklar"). */
export function getMatchBadge(
  match: Pick<MatchSnapshot, 'mustTotal' | 'mustCovered'>,
): MatchBadgeView {
  if (match.mustTotal === 0) {
    return {
      label: 'Inga krav listade',
      tone: 'outline',
      uncertain: false,
      tooltip: null,
    };
  }

  const ratio = match.mustCovered / match.mustTotal;
  const tone: BadgeTone = ratio >= 0.75 ? 'positive' : ratio >= 0.4 ? 'info' : 'neutral';
  const label = `${match.mustCovered} av ${match.mustTotal} krav`;

  if (match.mustTotal <= 3) {
    return {
      label,
      tone,
      uncertain: true,
      tooltip: `Annonsen listar bara ${match.mustTotal} krav – siffran är osäker.`,
    };
  }

  return { label, tone, uncertain: false, tooltip: null };
}

function formatTermList(terms: readonly string[], max = 3): string {
  if (terms.length === 0) return '';
  const shown = terms.slice(0, max);
  const extra = terms.length - shown.length;
  const body = shown.join(', ');
  return extra > 0 ? `${body} +${extra}` : body;
}

/**
 * Visible match summary under the card meta row — no hover required.
 * Example: "✓ integrationer · Saknas: Azure, C#, .NET +1"
 */
export function formatMatchSummary(
  match: Pick<MatchSnapshot, 'mustTotal' | 'covered' | 'gaps'>,
  maxTerms = 3,
): string | null {
  if (match.mustTotal === 0) return null;

  const covered = formatTermList(
    match.covered.map((item) => item.term),
    maxTerms,
  );
  const gaps = formatTermList(
    match.gaps.map((item) => item.term),
    maxTerms,
  );

  const parts: string[] = [];
  if (covered) parts.push(`✓ ${covered}`);
  if (gaps) parts.push(`Saknas: ${gaps}`);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/** Sort key for "Bäst CV-match": covered ratio, then score, then published date. */
export function compareCvMatch(
  a: {
    match: Pick<MatchSnapshot, 'mustCovered' | 'mustTotal' | 'score'> | null;
    publishedAt: string | null;
  },
  b: {
    match: Pick<MatchSnapshot, 'mustCovered' | 'mustTotal' | 'score'> | null;
    publishedAt: string | null;
  },
): number {
  const ratio = (match: typeof a.match) => {
    if (!match || match.mustTotal <= 0) return -1;
    return match.mustCovered / match.mustTotal;
  };
  const ratioDiff = ratio(b.match) - ratio(a.match);
  if (ratioDiff !== 0) return ratioDiff;

  const scoreA = a.match?.score ?? -1;
  const scoreB = b.match?.score ?? -1;
  if (scoreB !== scoreA) return scoreB - scoreA;

  const timeA = a.publishedAt ? Date.parse(a.publishedAt) : 0;
  const timeB = b.publishedAt ? Date.parse(b.publishedAt) : 0;
  return timeB - timeA;
}
