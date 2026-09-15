import { describe, expect, it } from 'vitest';
import { canonicalizeAuthEmailUrl } from './auth-email-url.ts';

describe('canonicalizeAuthEmailUrl', () => {
  const appUrl = 'https://jobbdjungeln.obackman.se';

  it('rewrites a vercel.app reset link onto APP_URL', () => {
    const input =
      'https://jobbdjungeln-web.vercel.app/api/auth/reset-password/token?callbackURL=%2Fnytt-losenord';
    const out = canonicalizeAuthEmailUrl(input, appUrl);
    expect(out).toBe(
      'https://jobbdjungeln.obackman.se/api/auth/reset-password/token?callbackURL=%2Fnytt-losenord',
    );
  });

  it('leaves an already-canonical link unchanged aside from normalization', () => {
    const input =
      'https://jobbdjungeln.obackman.se/api/auth/verify-email?token=abc&callbackURL=%2F';
    expect(canonicalizeAuthEmailUrl(input, appUrl)).toBe(input);
  });
});
