import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { operatorId } from './operator-id.ts';
import * as t from './schema.ts';
import { createTestDatabase, type TestDatabase } from './testing.ts';

let db: TestDatabase;

async function makeUser(email = `user-${crypto.randomUUID()}@example.test`) {
  const [user] = await db
    .insert(t.users)
    .values({ email, operatorId: operatorId() })
    .returning();
  if (!user) throw new Error('kunde inte skapa användare');
  return user;
}

beforeAll(async () => {
  db = await createTestDatabase();
});

afterAll(async () => {
  await db.$close();
});

describe('migrations', () => {
  it('creates every table', async () => {
    const result = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const rows = Array.isArray(result) ? result : result.rows;
    const tables = new Set(rows.map((row) => row.table_name));
    for (const name of [
      'users',
      'sessions',
      'accounts',
      'verifications',
      'applications',
      'application_events',
      'resumes',
      'saved_searches',
      'report_periods',
      'activities',
      'cached_ads',
      'digest_seen_ads',
    ]) {
      expect(tables).toContain(name);
    }
  });
});

describe('users', () => {
  it('treats e-mail as case-insensitively unique', async () => {
    await makeUser('Anna@Example.test');
    await expect(makeUser('anna@example.test')).rejects.toThrow();
  });

  it('defaults weekly summary to opt-in false', async () => {
    const user = await makeUser();
    expect(user.weeklySummaryOptIn).toBe(false);
    expect(user.reminderOptIn).toBe(true);
  });

  it('requires operator ids to be unique', async () => {
    const shared = operatorId();
    await db.insert(t.users).values({ email: 'a1@example.test', operatorId: shared });
    await expect(
      db.insert(t.users).values({ email: 'a2@example.test', operatorId: shared }),
    ).rejects.toThrow();
  });
});

describe('applications', () => {
  it('stores calendar dates as strings, untouched by any timezone', async () => {
    const user = await makeUser();
    const [row] = await db
      .insert(t.applications)
      .values({
        userId: user.id,
        company: 'Acme AB',
        title: 'Ekonomiassistent',
        appliedAt: '2026-06-30',
        deadline: '2026-12-31',
      })
      .returning();
    expect(row?.appliedAt).toBe('2026-06-30');
    expect(row?.deadline).toBe('2026-12-31');
  });

  it('stops the same ad being tracked twice by one user', async () => {
    const user = await makeUser();
    const values = {
      userId: user.id,
      company: 'Acme AB',
      title: 'Utvecklare',
      adUrlKey: 'https://example.test/jobb/1',
    };
    await db.insert(t.applications).values(values);
    await expect(db.insert(t.applications).values(values)).rejects.toThrow();
  });

  it('lets two different users track the same ad', async () => {
    const [a, b] = await Promise.all([makeUser(), makeUser()]);
    const values = {
      company: 'Acme AB',
      title: 'Utvecklare',
      adUrlKey: 'https://example.test/2',
    };
    await db.insert(t.applications).values({ ...values, userId: a.id });
    await expect(
      db.insert(t.applications).values({ ...values, userId: b.id }),
    ).resolves.not.toThrow();
  });

  it('exempts free-text rows, which have no ad URL, from the duplicate rule', async () => {
    const user = await makeUser();
    const values = { userId: user.id, company: 'Acme AB', title: 'Utvecklare' };
    await db.insert(t.applications).values(values);
    await expect(db.insert(t.applications).values(values)).resolves.not.toThrow();
  });

  it('rejects a status outside the pipeline', async () => {
    const user = await makeUser();
    await expect(
      db.execute(
        sql`insert into applications (user_id, company, title, status)
            values (${user.id}, 'Acme', 'Roll', 'hittepå')`,
      ),
    ).rejects.toThrow();
  });
});

describe('cascades', () => {
  it('erases everything a user owns when the account goes', async () => {
    const user = await makeUser();
    const [application] = await db
      .insert(t.applications)
      .values({ userId: user.id, company: 'Acme AB', title: 'Roll' })
      .returning();
    if (!application) throw new Error('ingen ansökan');

    await db.insert(t.applicationEvents).values({
      applicationId: application.id,
      occurredAt: '2026-06-01',
      note: 'Ringde rekryteraren',
    });
    await db.insert(t.resumes).values({ userId: user.id, headline: 'Ekonom' });
    await db.insert(t.savedSearches).values({ userId: user.id, query: 'ekonomi' });
    await db.insert(t.activities).values({
      userId: user.id,
      type: 'kurs',
      occurredOn: '2026-06-02',
      title: 'Excelkurs',
    });

    await db.delete(t.users).where(eq(t.users.id, user.id));

    expect(
      await db.select().from(t.applications).where(eq(t.applications.userId, user.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(t.applicationEvents)
        .where(eq(t.applicationEvents.applicationId, application.id)),
    ).toEqual([]);
    expect(await db.select().from(t.resumes).where(eq(t.resumes.userId, user.id))).toEqual([]);
    expect(
      await db.select().from(t.savedSearches).where(eq(t.savedSearches.userId, user.id)),
    ).toEqual([]);
    expect(
      await db.select().from(t.activities).where(eq(t.activities.userId, user.id)),
    ).toEqual([]);
  });

  it('keeps a report period from taking its rows down with it', async () => {
    const user = await makeUser();
    const [period] = await db
      .insert(t.reportPeriods)
      .values({ userId: user.id, year: 2026, month: 6 })
      .returning();
    if (!period) throw new Error('ingen period');

    const [application] = await db
      .insert(t.applications)
      .values({ userId: user.id, company: 'Acme AB', title: 'Roll', reportedInId: period.id })
      .returning();

    await db.delete(t.reportPeriods).where(eq(t.reportPeriods.id, period.id));

    const [after] = await db
      .select()
      .from(t.applications)
      .where(eq(t.applications.id, application?.id ?? ''));
    expect(after).toBeDefined();
    expect(after?.reportedInId).toBeNull();
  });
});

describe('report periods', () => {
  it('allows one period per user and month', async () => {
    const user = await makeUser();
    await db.insert(t.reportPeriods).values({ userId: user.id, year: 2026, month: 3 });
    await expect(
      db.insert(t.reportPeriods).values({ userId: user.id, year: 2026, month: 3 }),
    ).rejects.toThrow();
    await expect(
      db.insert(t.reportPeriods).values({ userId: user.id, year: 2026, month: 4 }),
    ).resolves.not.toThrow();
  });
});

describe('operatorId', () => {
  it('avoids characters that are misread aloud', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(operatorId()).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
    }
  });

  it('does not repeat itself', () => {
    const seen = new Set(Array.from({ length: 500 }, () => operatorId()));
    expect(seen.size).toBe(500);
  });
});
