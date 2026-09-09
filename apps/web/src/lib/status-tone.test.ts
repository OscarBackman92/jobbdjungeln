import { isClosed, STATUSES } from '@jobbdjungeln/core';
import { describe, expect, it } from 'vitest';
import { statusTone } from './status-tone';

describe('statusTone', () => {
  it('gives every status a tone', () => {
    for (const status of STATUSES) {
      expect(statusTone(status)).toBeTruthy();
    }
  });

  it('reserves green for a real win and red for a closed door', () => {
    expect(statusTone('accepted')).toBe('positive');
    expect(statusTone('rejected')).toBe('danger');
    expect(statusTone('offer')).toBe('warning');
  });

  it('keeps the middle of the pipeline quiet, so the loud ones stand out', () => {
    const loud = new Set(['positive', 'danger', 'warning']);
    const midPipeline = STATUSES.filter(
      (status) => !isClosed(status) && status !== 'offer' && status !== 'wishlist',
    );
    for (const status of midPipeline) {
      expect(loud.has(statusTone(status))).toBe(false);
    }
  });
});
