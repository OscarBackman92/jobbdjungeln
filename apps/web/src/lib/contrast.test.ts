import { describe, expect, it } from 'vitest';
import { CONTRAST_PAIRS, contrastRatio } from './contrast.ts';

describe('WCAG contrast tokens', () => {
  for (const [theme, pairs] of Object.entries(CONTRAST_PAIRS)) {
    describe(theme, () => {
      for (const pair of pairs) {
        it(`${pair.name} is at least 4.5:1`, () => {
          expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(4.5);
        });
      }
    });
  }
});
