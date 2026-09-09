import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { sendReminders } from '@/server/jobs/reminders';
import { pruneCaches, pruneInactiveAccounts } from '@/server/jobs/retention';
import { sendWeeklySummaries } from '@/server/jobs/weekly-summary';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Scheduled jobs.
 *
 * Authenticated with a shared secret in the Authorization header, compared in
 * constant time so the endpoint cannot be probed a byte at a time. Without
 * `CRON_SECRET` these run only outside production — and the environment schema
 * refuses to boot production without one.
 */

const JOBS = {
  paminnelser: sendReminders,
  veckobrev: sendWeeklySummaries,
  gallring: async () => ({
    ...(await pruneInactiveAccounts()),
    ...(await pruneCaches()),
  }),
} as const;

type JobName = keyof typeof JOBS;

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

export async function GET(request: Request, context: { params: Promise<{ job: string }> }) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Otillåten.' }, { status: 401 });
  }

  const { job } = await context.params;
  const run = JOBS[job as JobName];
  if (!run) return NextResponse.json({ error: 'Okänt jobb.' }, { status: 404 });

  const startedAt = Date.now();
  try {
    const result = await run();
    console.info(`[cron] ${job} klart`, { ...result, ms: Date.now() - startedAt });
    return NextResponse.json({ job, ...result, ms: Date.now() - startedAt });
  } catch (error) {
    console.error(`[cron] ${job} misslyckades`, error);
    return NextResponse.json({ job, error: 'Jobbet misslyckades.' }, { status: 500 });
  }
}
