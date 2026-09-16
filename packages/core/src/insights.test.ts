import { describe, expect, it } from 'vitest';
import { buildSkillInsights, type InsightRow } from './insights.ts';

function row(overrides: Partial<InsightRow> = {}): InsightRow {
  return {
    status: 'applied',
    archived: false,
    matchScore: 50,
    matchScoredAt: '2026-06-01T08:00:00.000Z',
    matchSnapshot: {
      mustTotal: 4,
      meritTotal: 1,
      gaps: [{ term: 'SQL', level: 'must' }],
      covered: [{ term: 'Excel' }],
      unusedCvTerms: ['Truckkort'],
    },
    ...overrides,
  };
}

describe('buildSkillInsights', () => {
  it('lists gaps the CV does not already cover', () => {
    const insights = buildSkillInsights(
      [row(), row({ matchScore: 80 }), row({ matchScore: 55 })],
      ['Excel'],
    );
    expect(insights.gapTerms.map((item) => item.term)).toContain('SQL');
    expect(insights.gapTerms.map((item) => item.term)).not.toContain('Excel');
    expect(insights.hitTerms.map((item) => item.term)).toContain('Excel');
    expect(insights.scope.withSnapshot).toBe(3);
  });

  it('hides gaps the user already owns', () => {
    const insights = buildSkillInsights([row()], ['SQL']);
    expect(insights.gapTerms).toEqual([]);
  });

  it('needs five scored rows before a band reports a rate', () => {
    const insights = buildSkillInsights([row()]);
    const mid = insights.responseByBand.find((band) => band.band === '40-69');
    expect(mid?.insufficientData).toBe(true);
    expect(mid?.rate).toBeNull();
  });
});
