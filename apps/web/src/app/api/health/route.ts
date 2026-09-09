import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Health check.
 *
 * Touches the database, because a process that answers while its database is
 * unreachable is not healthy in any sense a monitor should accept.
 */
export async function GET() {
  try {
    await db().execute(sql`select 1`);
    return NextResponse.json(
      { status: 'ok', time: new Date().toISOString() },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    console.error('[health] databasen svarar inte', error);
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
