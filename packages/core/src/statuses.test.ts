import { describe, expect, it } from 'vitest';
import {
  allowedNextStatuses,
  furthestStage,
  gotReply,
  hasApplied,
  initialFurthestStage,
  isClosed,
  isTransitionAllowed,
  isWishlist,
  outcomeForStatus,
  STATUSES,
  stageForStatus,
} from './statuses.ts';

describe('status projection', () => {
  it('projects every status onto a stage', () => {
    for (const status of STATUSES) {
      expect(stageForStatus(status)).toBeTruthy();
    }
  });

  it('only closed statuses carry an outcome', () => {
    for (const status of STATUSES) {
      const outcome = outcomeForStatus(status);
      expect(outcome === null).toBe(!isClosed(status));
    }
  });

  it('treats wishlist as the only saved stage', () => {
    expect(isWishlist('wishlist')).toBe(true);
    expect(isWishlist('applied')).toBe(false);
  });

  it('counts every post-wishlist non-terminal status as applied', () => {
    expect(hasApplied('applied')).toBe(true);
    expect(hasApplied('offer')).toBe(true);
    expect(hasApplied('accepted')).toBe(true);
    expect(hasApplied('wishlist')).toBe(false);
    expect(hasApplied('rejected')).toBe(false);
  });
});

describe('transitions', () => {
  it('always allows a no-op', () => {
    for (const status of STATUSES) {
      expect(isTransitionAllowed(status, status)).toBe(true);
      expect(allowedNextStatuses(status)).not.toContain(status);
    }
  });

  it('lets a saved job be applied to or withdrawn, but not skipped ahead', () => {
    expect(isTransitionAllowed('wishlist', 'applied')).toBe(true);
    expect(isTransitionAllowed('wishlist', 'withdrawn')).toBe(true);
    expect(isTransitionAllowed('wishlist', 'interview')).toBe(false);
    expect(isTransitionAllowed('wishlist', 'offer')).toBe(false);
    expect(isTransitionAllowed('wishlist', 'accepted')).toBe(false);
    expect(isTransitionAllowed('wishlist', 'rejected')).toBe(false);
    expect(allowedNextStatuses('wishlist')).toEqual(['applied', 'withdrawn']);
  });

  it('allows moving between statuses inside the same stage', () => {
    // screening and forwarded are both "kontakt".
    expect(isTransitionAllowed('screening', 'forwarded')).toBe(true);
  });

  it('allows reopening a closed application', () => {
    expect(isTransitionAllowed('rejected', 'interview')).toBe(true);
    // …but not back into the wishlist: it has already been applied to.
    expect(isTransitionAllowed('rejected', 'wishlist')).toBe(false);
  });

  it('never offers a transition back to the wishlist', () => {
    for (const status of STATUSES) {
      if (status === 'wishlist') continue;
      expect(allowedNextStatuses(status)).not.toContain('wishlist');
    }
  });

  it('lets an offer only be closed out', () => {
    expect(allowedNextStatuses('offer').every((next) => isClosed(next))).toBe(true);
  });
});

describe('furthest stage', () => {
  it('keeps an interview when the row is later rejected', () => {
    expect(furthestStage('intervju', 'avslutad')).toBe('intervju');
  });

  it('advances when the new stage is further along', () => {
    expect(furthestStage('sokt', 'intervju')).toBe('intervju');
  });

  it('treats a row created as rejected as having been applied for', () => {
    expect(initialFurthestStage('rejected')).toBe('sokt');
    expect(initialFurthestStage('interview')).toBe('intervju');
  });
});

describe('got reply', () => {
  it('counts an employer reply, including rejection', () => {
    expect(gotReply('interview')).toBe(true);
    expect(gotReply('rejected')).toBe(true);
    expect(gotReply('applied')).toBe(false);
    expect(gotReply('no_response')).toBe(false);
    expect(gotReply('wishlist')).toBe(false);
  });
});
