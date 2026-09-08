import { describe, expect, it } from 'vitest';
import {
  appliedLaneFor,
  deriveApplyBy,
  employerKey,
  isFollowUpOverdue,
  isOverdue,
  isStale,
  requiresSalaryClaim,
  salaryClaimMissingOnApply,
  savedLaneFor,
  waitingDays,
} from './lifecycle.ts';

const TODAY = '2026-06-15';

describe('waiting time', () => {
  it('counts from the last activity, falling back to the applied date', () => {
    expect(
      waitingDays({ status: 'applied', appliedAt: '2026-06-01', lastActivityAt: null }, TODAY),
    ).toBe(14);
    expect(
      waitingDays(
        { status: 'applied', appliedAt: '2026-06-01', lastActivityAt: '2026-06-10' },
        TODAY,
      ),
    ).toBe(5);
  });

  it('is undefined once there has been contact — the wait is over', () => {
    expect(
      waitingDays(
        { status: 'interview', appliedAt: '2026-05-01', lastActivityAt: null },
        TODAY,
      ),
    ).toBeNull();
    expect(
      waitingDays({ status: 'wishlist', appliedAt: null, lastActivityAt: null }, TODAY),
    ).toBeNull();
  });

  it('flags a week without a reply as overdue', () => {
    const base = { status: 'applied', lastActivityAt: null } as const;
    expect(isOverdue({ ...base, appliedAt: '2026-06-09' }, TODAY)).toBe(false); // 6 days
    expect(isOverdue({ ...base, appliedAt: '2026-06-08' }, TODAY)).toBe(true); // 7 days
  });

  it('flags a long silence as stale', () => {
    const base = { status: 'applied', lastActivityAt: null } as const;
    expect(isStale({ ...base, appliedAt: '2026-05-02' }, TODAY)).toBe(false); // 44 days
    expect(isStale({ ...base, appliedAt: '2026-04-30' }, TODAY)).toBe(true); // 46 days
  });
});

describe('follow-ups', () => {
  it('is overdue only when the date has passed', () => {
    expect(isFollowUpOverdue({ status: 'applied', nextActionAt: '2026-06-14' }, TODAY)).toBe(
      true,
    );
    expect(isFollowUpOverdue({ status: 'applied', nextActionAt: TODAY }, TODAY)).toBe(false);
    expect(isFollowUpOverdue({ status: 'applied', nextActionAt: null }, TODAY)).toBe(false);
  });

  it('never nags about a closed application', () => {
    expect(isFollowUpOverdue({ status: 'rejected', nextActionAt: '2026-01-01' }, TODAY)).toBe(
      false,
    );
  });
});

describe('deriveApplyBy', () => {
  it('uses the ad deadline when there is one', () => {
    expect(
      deriveApplyBy({ status: 'wishlist', deadline: '2026-06-20', createdAt: '2026-06-01' }),
    ).toEqual({ applyBy: '2026-06-20', isAuto: false });
  });

  it('falls back to a two-week nudge from when it was saved', () => {
    expect(
      deriveApplyBy({ status: 'wishlist', deadline: null, createdAt: '2026-06-01' }),
    ).toEqual({
      applyBy: '2026-06-15',
      isAuto: true,
    });
  });

  it('does not apply to rows that have already been applied to', () => {
    expect(
      deriveApplyBy({ status: 'applied', deadline: '2026-06-20', createdAt: '2026-06-01' }),
    ).toBeNull();
  });
});

describe('saved lanes', () => {
  const lane = (applyBy: string | null, intent: 'active' | 'paused' = 'active') =>
    savedLaneFor({ intent, applyBy }, TODAY);

  it('sorts by urgency', () => {
    expect(lane('2026-06-14')).toBe('utgangna');
    expect(lane(TODAY)).toBe('brattom');
    expect(lane('2026-06-22')).toBe('brattom'); // exactly 7 days
    expect(lane('2026-06-23')).toBe('denna_manad');
    expect(lane(null)).toBe('utan_datum');
  });

  it('puts paused rows on ice regardless of date', () => {
    expect(lane('2026-06-01', 'paused')).toBe('pa_is');
    expect(lane(null, 'paused')).toBe('pa_is');
  });
});

describe('applied lanes', () => {
  const lane = (
    status: Parameters<typeof appliedLaneFor>[0]['status'],
    appliedAt: string | null,
  ) => appliedLaneFor({ status, appliedAt, lastActivityAt: null }, TODAY);

  it('separates silence from dialogue from closure', () => {
    expect(lane('applied', '2026-06-14')).toBe('nyligen_sokta');
    expect(lane('applied', '2026-06-01')).toBe('vantar_for_lange');
    expect(lane('screening', '2026-06-01')).toBe('i_dialog');
    expect(lane('interview', '2026-06-01')).toBe('i_dialog');
    expect(lane('offer', '2026-06-01')).toBe('erbjudande');
    expect(lane('rejected', '2026-06-01')).toBe('avslutade');
    expect(lane('accepted', '2026-06-01')).toBe('avslutade');
  });
});

describe('employerKey', () => {
  it('collapses company forms and punctuation', () => {
    expect(employerKey('Acme AB')).toBe('acme');
    expect(employerKey('Acme  Aktiebolag')).toBe('acme');
    expect(employerKey('Acme & Söner AB')).toBe('acme söner');
    expect(employerKey('ACME ab.')).toBe('acme');
  });

  it('keeps Swedish letters intact', () => {
    expect(employerKey('Företaget Åkeri AB')).toBe('företaget åkeri');
  });

  it('handles empty input', () => {
    expect(employerKey('')).toBe('');
  });
});

describe('salary claim', () => {
  it('is asked for once the user has actually applied', () => {
    expect(requiresSalaryClaim('wishlist')).toBe(false);
    expect(requiresSalaryClaim('applied')).toBe(true);
    expect(requiresSalaryClaim('offer')).toBe(true);
    // Nothing to ask for once the door is closed.
    expect(requiresSalaryClaim('rejected')).toBe(false);
  });

  it('is required when a saved job becomes an application', () => {
    expect(
      salaryClaimMissingOnApply({
        status: 'applied',
        salaryClaim: '',
        previousStatus: 'wishlist',
      }),
    ).toBe(true);
    expect(
      salaryClaimMissingOnApply({
        status: 'applied',
        salaryClaim: '45 000 kr/mån',
        previousStatus: 'wishlist',
      }),
    ).toBe(false);
  });

  it('is required when a row is created as already applied', () => {
    expect(salaryClaimMissingOnApply({ status: 'applied', salaryClaim: '' })).toBe(true);
    expect(salaryClaimMissingOnApply({ status: 'wishlist', salaryClaim: '' })).toBe(false);
  });

  it('is not re-asked when moving between post-application statuses', () => {
    expect(
      salaryClaimMissingOnApply({
        status: 'interview',
        salaryClaim: '',
        previousStatus: 'applied',
      }),
    ).toBe(false);
  });

  it('treats whitespace as missing', () => {
    expect(salaryClaimMissingOnApply({ status: 'applied', salaryClaim: '   ' })).toBe(true);
  });
});
