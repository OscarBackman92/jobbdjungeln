import { describe, expect, it } from 'vitest';
import {
  compareCvMatch,
  formatMatchSummary,
  getMatchBadge,
} from '@/components/jobs/match-badge-logic';

describe('getMatchBadge', () => {
  it('shows a muted label when no requirements are listed', () => {
    expect(getMatchBadge({ mustTotal: 0, mustCovered: 0 })).toEqual({
      label: 'Inga krav listade',
      tone: 'outline',
      uncertain: false,
      tooltip: null,
    });
  });

  it('marks 1–3 requirements as uncertain with a dashed style', () => {
    expect(getMatchBadge({ mustTotal: 2, mustCovered: 2 })).toEqual({
      label: '2 av 2 krav',
      tone: 'positive',
      uncertain: true,
      tooltip: 'Annonsen listar bara 2 krav – siffran är osäker.',
    });
    expect(getMatchBadge({ mustTotal: 1, mustCovered: 0 }).uncertain).toBe(true);
    expect(getMatchBadge({ mustTotal: 3, mustCovered: 1 }).tone).toBe('neutral');
  });

  it('uses solid style and coverage colours from 4 requirements up', () => {
    expect(getMatchBadge({ mustTotal: 4, mustCovered: 3 })).toMatchObject({
      label: '3 av 4 krav',
      tone: 'positive',
      uncertain: false,
      tooltip: null,
    });
    expect(getMatchBadge({ mustTotal: 5, mustCovered: 2 }).tone).toBe('info');
    expect(getMatchBadge({ mustTotal: 6, mustCovered: 0 }).tone).toBe('neutral');
  });
});

describe('formatMatchSummary', () => {
  it('formats covered and missing terms with a +N overflow', () => {
    expect(
      formatMatchSummary({
        mustTotal: 5,
        covered: [{ term: 'integrationer', level: 'must', snippet: '', source: {} }],
        gaps: [
          { term: 'Azure', level: 'must', snippet: '' },
          { term: 'C#', level: 'must', snippet: '' },
          { term: '.NET', level: 'must', snippet: '' },
          { term: 'SQL', level: 'must', snippet: '' },
        ],
      }),
    ).toBe('✓ integrationer · Saknas: Azure, C#, .NET +1');
  });

  it('returns null when there are no requirements', () => {
    expect(formatMatchSummary({ mustTotal: 0, covered: [], gaps: [] })).toBeNull();
  });
});

describe('compareCvMatch', () => {
  it('orders by coverage ratio, then score, then published date', () => {
    const items = [
      {
        match: { mustCovered: 1, mustTotal: 2, score: 50 },
        publishedAt: '2026-01-02',
      },
      {
        match: { mustCovered: 2, mustTotal: 2, score: 40 },
        publishedAt: '2026-01-01',
      },
      {
        match: { mustCovered: 1, mustTotal: 2, score: 80 },
        publishedAt: '2026-01-01',
      },
    ];
    const sorted = [...items].sort(compareCvMatch);
    expect(sorted.map((item) => item.match.score)).toEqual([40, 80, 50]);
  });
});
