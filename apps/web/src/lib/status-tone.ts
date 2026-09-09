import type { Status } from '@jobbdjungeln/core';
import type { BadgeTone } from '@/components/ui';

/**
 * How each status is coloured.
 *
 * Reserved status colours, used only for state: green for a real win, red for a
 * closed door, amber for something waiting on the user. Everything mid-pipeline
 * stays neutral, so the coloured ones actually stand out.
 */
const TONES: Readonly<Record<Status, BadgeTone>> = {
  wishlist: 'neutral',
  applied: 'info',
  screening: 'brand',
  interview: 'brand',
  forwarded: 'brand',
  offer: 'warning',
  accepted: 'positive',
  rejected: 'danger',
  no_response: 'neutral',
  withdrawn: 'neutral',
};

export function statusTone(status: Status): BadgeTone {
  return TONES[status];
}
