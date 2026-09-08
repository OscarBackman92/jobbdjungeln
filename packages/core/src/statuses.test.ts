import { describe, expect, it } from 'vitest';
import {
  allowedNextStatuses,
  hasApplied,
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

  it('lets a saved job be applied to or dropped, but not skipped ahead', () => {
    expect(isTransitionAllowed('wishlist', 'applied')).toBe(true);
    expect(isTransitionAllowed('wishlist', 'withdrawn')).toBe(true);
    expect(isTransitionAllowed('wishlist', 'interview')).toBe(false);
    expect(isTransitionAllowed('wishlist', 'offer')).toBe(false);
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
