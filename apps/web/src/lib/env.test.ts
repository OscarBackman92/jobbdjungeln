import { describe, expect, it } from 'vitest';
import { envSchema } from './env';

/**
 * These rules are the difference between a safe deployment and an open one, so
 * they are pinned rather than left to a code review.
 */

const VALID = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://user:pass@db.example.test:5432/jobbdjungeln',
  AUTH_SECRET: 'a'.repeat(32),
  APP_URL: 'https://jobbdjungeln.example.test',
  CRON_SECRET: 'b'.repeat(16),
  BREVO_API_KEY: 'xkeysib-test',
};

function messagesFor(input: Record<string, unknown>): string[] {
  const result = envSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('miljökonfiguration', () => {
  it('accepterar en komplett produktionsuppsättning', () => {
    const parsed = envSchema.safeParse(VALID);
    expect(parsed.success).toBe(true);
  });

  it('vägrar produktion över http', () => {
    expect(messagesFor({ ...VALID, APP_URL: 'http://jobbdjungeln.example.test' })).toContain(
      'APP_URL',
    );
  });

  it('vägrar produktion utan hemlighet för de schemalagda jobben', () => {
    const { CRON_SECRET: _omitted, ...utan } = VALID;
    expect(messagesFor(utan)).toContain('CRON_SECRET');
  });

  it('vägrar produktion utan e-postleverantör', () => {
    const { BREVO_API_KEY: _omitted, ...utan } = VALID;
    expect(messagesFor(utan)).toContain('BREVO_API_KEY');
    expect(messagesFor({ ...utan, SMTP_URL: 'smtp://user:pass@mail.example.test:587' })).toEqual(
      [],
    );
  });

  it('vägrar produktion med testläget påslaget', () => {
    expect(messagesFor({ ...VALID, AUTH_TEST_MODE: '1' })).toContain('AUTH_TEST_MODE');
  });

  it('vägrar en för kort sessionshemlighet', () => {
    expect(messagesFor({ ...VALID, AUTH_SECRET: 'kort' })).toContain('AUTH_SECRET');
  });

  it('vägrar en databas-URL som inte är postgres', () => {
    expect(messagesFor({ ...VALID, DATABASE_URL: 'mysql://user:pass@db/x' })).toContain(
      'DATABASE_URL',
    );
  });

  it('kräver både id och hemlighet för Google-inloggning, eller ingetdera', () => {
    expect(messagesFor({ ...VALID, GOOGLE_CLIENT_ID: 'abc' })).toContain(
      'GOOGLE_CLIENT_SECRET',
    );
    expect(
      messagesFor({ ...VALID, GOOGLE_CLIENT_ID: 'abc', GOOGLE_CLIENT_SECRET: 'def' }),
    ).toEqual([]);
  });

  it('släpper igenom utveckling utan produktionskraven', () => {
    const parsed = envSchema.safeParse({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://postgres@127.0.0.1:5432/jobbdjungeln',
      AUTH_SECRET: 'a'.repeat(32),
      APP_URL: 'http://localhost:3000',
      AUTH_TEST_MODE: '1',
    });
    expect(parsed.success).toBe(true);
  });

  it('trimmar bort avslutande snedstreck från APP_URL', () => {
    const parsed = envSchema.parse({ ...VALID, APP_URL: 'https://exempel.test/' });
    expect(parsed.APP_URL).toBe('https://exempel.test');
  });
});
