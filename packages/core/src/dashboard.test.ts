import { describe, expect, it } from 'vitest';
import { buildFunnel, buildNextActions, buildSummary, type DashboardRow } from './dashboard.ts';
import type { Stage } from './statuses.ts';

const TODAY = '2026-06-15';

function row(
  overrides: Partial<DashboardRow> & Pick<DashboardRow, 'id' | 'status'>,
): DashboardRow {
  return {
    company: 'Acme AB',
    title: 'Ekonomiassistent',
    intent: 'active',
    appliedAt: null,
    applyBy: null,
    deadline: null,
    nextActionAt: null,
    lastActivityAt: null,
    archivedAt: null,
    ...overrides,
  };
}

describe('buildFunnel', () => {
  it('is cumulative — reaching a stage counts for every stage before it', () => {
    const funnel = buildFunnel(['sokt', 'kontakt', 'intervju', 'erbjudande']);
    expect(funnel.map((step) => step.count)).toEqual([4, 3, 2, 1]);
    expect(funnel.map((step) => step.share)).toEqual([100, 75, 50, 25]);
  });

  it('handles an empty pipeline without dividing by zero', () => {
    const funnel = buildFunnel([]);
    expect(funnel.every((step) => step.count === 0 && step.share === 0)).toBe(true);
  });

  it('ignores stages outside the funnel, such as closed rows', () => {
    const funnel = buildFunnel(['sokt', 'avslutad' as Stage]);
    expect(funnel[0]?.count).toBe(1);
  });
});

describe('buildNextActions', () => {
  it('prefers an explicit follow-up over the apply-by nudge', () => {
    const actions = buildNextActions(
      [row({ id: '1', status: 'wishlist', applyBy: '2026-06-30', nextActionAt: '2026-06-20' })],
      TODAY,
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]?.kind).toBe('follow_up');
    expect(actions[0]?.due).toBe('2026-06-20');
  });

  it('marks a real ad deadline apart from the automatic nudge', () => {
    const [withDeadline] = buildNextActions(
      [row({ id: '1', status: 'wishlist', applyBy: '2026-06-30', deadline: '2026-06-30' })],
      TODAY,
    );
    expect(withDeadline?.kind).toBe('deadline');

    const [nudge] = buildNextActions(
      [row({ id: '2', status: 'wishlist', applyBy: '2026-06-30' })],
      TODAY,
    );
    expect(nudge?.kind).toBe('apply_by');
  });

  it('flags a passed date as overdue', () => {
    const [action] = buildNextActions(
      [row({ id: '1', status: 'applied', nextActionAt: '2026-06-01' })],
      TODAY,
    );
    expect(action?.overdue).toBe(true);
  });

  it('sorts by due date, soonest first', () => {
    const actions = buildNextActions(
      [
        row({ id: 'late', status: 'applied', nextActionAt: '2026-07-01' }),
        row({ id: 'soon', status: 'applied', nextActionAt: '2026-06-16' }),
      ],
      TODAY,
    );
    expect(actions.map((action) => action.id)).toEqual(['soon', 'late']);
  });

  it('leaves closed and archived rows out', () => {
    const actions = buildNextActions(
      [
        row({ id: 'closed', status: 'rejected', nextActionAt: '2026-06-16' }),
        row({
          id: 'archived',
          status: 'applied',
          nextActionAt: '2026-06-16',
          archivedAt: new Date(),
        }),
      ],
      TODAY,
    );
    expect(actions).toEqual([]);
  });

  it('caps the list so the dashboard stays readable', () => {
    const many = Array.from({ length: 20 }, (_, index) =>
      row({ id: `${index}`, status: 'applied', nextActionAt: '2026-06-20' }),
    );
    expect(buildNextActions(many, TODAY)).toHaveLength(8);
  });
});

describe('buildSummary', () => {
  const rows: DashboardRow[] = [
    row({ id: 'saved-urgent', status: 'wishlist', applyBy: '2026-06-18' }),
    row({ id: 'saved-later', status: 'wishlist', applyBy: '2026-07-30' }),
    row({ id: 'saved-paused', status: 'wishlist', applyBy: '2026-06-18', intent: 'paused' }),
    row({ id: 'fresh', status: 'applied', appliedAt: '2026-06-14' }),
    row({ id: 'silent', status: 'applied', appliedAt: '2026-05-20' }),
    row({ id: 'talking', status: 'interview', appliedAt: '2026-05-01' }),
    row({ id: 'won', status: 'accepted', appliedAt: '2026-04-01' }),
    row({ id: 'lost', status: 'rejected', appliedAt: '2026-04-02' }),
    row({ id: 'gone', status: 'applied', appliedAt: '2026-06-01', archivedAt: new Date() }),
  ];

  const furthest = new Map<string, Stage>([
    ['fresh', 'sokt'],
    ['silent', 'sokt'],
    ['talking', 'intervju'],
    ['won', 'erbjudande'],
    ['lost', 'kontakt'],
  ]);

  const summary = buildSummary({ rows, furthestStageById: furthest, today: TODAY });

  it('counts saved jobs apart from applications', () => {
    expect(summary.saved).toBe(3);
    expect(summary.savedLanes.denna_vecka).toBe(1);
    expect(summary.savedLanes.langre_fram).toBe(1);
    expect(summary.savedLanes.pa_is).toBe(1);
  });

  it('excludes archived rows from every count', () => {
    const total = summary.saved + summary.active + summary.closed;
    expect(total).toBe(8);
  });

  it('separates silence, dialogue and closure', () => {
    expect(summary.waitingTooLong).toBe(1);
    expect(summary.inDialog).toBe(1);
    expect(summary.closed).toBe(2);
    expect(summary.appliedLanes.nyligen_sokta).toBe(1);
    expect(summary.appliedLanes.vantar_for_lange).toBe(1);
  });

  it('records outcomes for closed rows', () => {
    expect(summary.outcomes.tackade_ja).toBe(1);
    expect(summary.outcomes.avslag).toBe(1);
    expect(summary.outcomes.inget_svar).toBe(0);
  });

  it('computes the response rate from the furthest stage reached', () => {
    // 5 applications, 3 of which got past "sökt".
    expect(summary.responseRate).toBe(60);
  });

  it('reports no response rate at all when nothing has been applied to', () => {
    const empty = buildSummary({
      rows: [row({ id: 'a', status: 'wishlist' })],
      furthestStageById: new Map(),
      today: TODAY,
    });
    expect(empty.responseRate).toBeNull();
    expect(empty.funnel.every((step) => step.count === 0)).toBe(true);
  });

  it('shows six months of history, oldest first', () => {
    expect(summary.monthly).toHaveLength(6);
    expect(summary.monthly.at(0)?.key).toBe('2026-01');
    expect(summary.monthly.at(-1)?.key).toBe('2026-06');
    // June holds only "fresh" — the archived row is excluded everywhere.
    expect(summary.monthly.find((point) => point.key === '2026-06')?.applied).toBe(1);
    expect(summary.monthly.find((point) => point.key === '2026-05')?.applied).toBe(2);
  });

  it('measures pace as applications per week over the last four weeks', () => {
    // fresh (14 June) and silent (20 May, 26 days ago) fall inside the window.
    expect(summary.pace).toBe(0.5);
  });
});
