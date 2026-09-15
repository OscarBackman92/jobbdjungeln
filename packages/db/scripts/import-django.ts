/**
 * Import a Django dump into a new empty Jobbdjungeln database.
 *
 *   SOURCE_DATABASE_URL  read-only connection to the dump (never the live
 *                        write path — the session is set read-only)
 *   DATABASE_URL         empty target that already has migrations applied
 *
 *   pnpm db:import-django:dry
 *   pnpm db:import-django
 *
 * Never dump-restore Django tables into the new app. Never point DATABASE_URL
 * at the old Supabase tables. Leave the source untouched for 14 days.
 */

import postgres from 'postgres';
import { createDatabase } from '../src/client.ts';
import {
  applyImport,
  assertReadOnlySql,
  fetchDjangoDump,
  planImport,
} from '../src/import-django.ts';

function arg(flag: string): boolean {
  return process.argv.includes(flag);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Saknar ${name}.`);
    process.exit(1);
  }
  return value;
}

async function querySource(
  sql: ReturnType<typeof postgres>,
): Promise<<T extends Record<string, unknown>>(text: string) => Promise<T[]>> {
  await sql`set session characteristics as transaction read only`;
  return async <T extends Record<string, unknown>>(text: string) => {
    assertReadOnlySql(text);
    const rows = await sql.unsafe(text);
    return rows as unknown as T[];
  };
}

function printReport(label: string, planned: ReturnType<typeof planImport>): void {
  console.info(`[import] ${label}`);
  console.info(JSON.stringify(planned.report.counts, null, 2));
  if (planned.report.warnings.length > 0) {
    console.info(`[import] ${planned.report.warnings.length} varningar:`);
    for (const warning of planned.report.warnings) console.info(`  - ${warning}`);
  }
  if (planned.report.errors.length > 0) {
    console.error(`[import] ${planned.report.errors.length} fel:`);
    for (const error of planned.report.errors) console.error(`  - ${error}`);
  }
  console.info(`[import] ${planned.report.resetEmails.length} adresser behöver lösenordsreset`);
}

async function main(): Promise<void> {
  const dryRun = arg('--dry-run');
  const force = arg('--force');
  const sourceUrl = requiredEnv('SOURCE_DATABASE_URL');
  const targetUrl = requiredEnv('DATABASE_URL');

  if (sourceUrl === targetUrl) {
    throw new Error('SOURCE_DATABASE_URL och DATABASE_URL får inte vara samma databas.');
  }

  const source = postgres(sourceUrl, { max: 1, prepare: false });
  const targetSql = postgres(targetUrl, { max: 1, prepare: false });
  const target = createDatabase({ url: targetUrl, max: 1 });

  try {
    const query = await querySource(source);
    const dump = await fetchDjangoDump(query);
    const planned = planImport(dump);
    printReport(dryRun ? 'dry-run' : 'plan', planned);

    if (planned.report.errors.length > 0) {
      process.exitCode = 1;
      return;
    }

    if (dryRun) return;

    const existing = await targetSql<{ count: string }[]>`
      select count(*)::text as count from users
    `;
    const count = existing[0]?.count ?? '0';
    if (Number(count) > 0 && !force) {
      throw new Error(
        `Måldatabasen är inte tom (${count} users). Använd en ny databas, eller --force.`,
      );
    }

    await applyImport(target, planned);
    console.info('[import] klart. Skicka lösenordsåterställning till resetEmails.');
  } finally {
    await source.end({ timeout: 5 });
    await targetSql.end({ timeout: 5 });
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
