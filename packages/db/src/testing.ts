/**
 * An embedded Postgres for tests.
 *
 * PGlite is real Postgres compiled to WASM, so migrations, enums, partial unique
 * indexes and cascade rules are exercised exactly as they will be in production
 * — without anyone needing a database server to run the suite.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema.ts';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'drizzle');

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>> & {
  $close: () => Promise<void>;
};

/** A fresh, migrated, in-memory database. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzle(client, { schema, casing: 'snake_case' });

  const entries = await readdir(MIGRATIONS_DIR);
  const migrations = entries.filter((name) => name.endsWith('.sql')).sort();
  if (migrations.length === 0) {
    throw new Error(`Inga migrationer hittades i ${MIGRATIONS_DIR}`);
  }

  for (const name of migrations) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, name), 'utf8');
    // drizzle-kit separates independent statements with this marker.
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed) await client.exec(trimmed);
    }
  }

  return Object.assign(db, { $close: () => client.close() });
}
