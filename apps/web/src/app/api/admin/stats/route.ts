import { schema } from '@jobbdjungeln/db';
import { count, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Aggregate DB counts for the operator — no PII, no third-party analytics.
 * Same bearer auth as cron jobs.
 */

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

function authorized(request: Request): boolean {
  const config = env();
  if (!config.CRON_SECRET) return config.NODE_ENV !== 'production';
  const header = request.headers.get('authorization') ?? '';
  return timingSafeEqual(header, `Bearer ${config.CRON_SECRET}`);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Otillåten.' }, { status: 401 });
  }

  const database = db();
  const [
    [users],
    [applications],
    [activities],
    [reportPeriods],
    [savedSearches],
    [resumes],
    [sessions],
    [activeWeek],
  ] = await Promise.all([
    database.select({ value: count() }).from(schema.users),
    database.select({ value: count() }).from(schema.applications),
    database.select({ value: count() }).from(schema.activities),
    database.select({ value: count() }).from(schema.reportPeriods),
    database.select({ value: count() }).from(schema.savedSearches),
    database.select({ value: count() }).from(schema.resumes),
    database.select({ value: count() }).from(schema.sessions),
    database
      .select({ value: count() })
      .from(schema.users)
      .where(sql`${schema.users.lastSeenAt} > now() - interval '7 days'`),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    counts: {
      users: users?.value ?? 0,
      usersActiveLast7Days: activeWeek?.value ?? 0,
      applications: applications?.value ?? 0,
      activities: activities?.value ?? 0,
      reportPeriods: reportPeriods?.value ?? 0,
      savedSearches: savedSearches?.value ?? 0,
      resumes: resumes?.value ?? 0,
      sessions: sessions?.value ?? 0,
    },
  });
}
