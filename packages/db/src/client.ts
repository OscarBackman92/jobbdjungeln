/**
 * Database client.
 *
 * One pooled connection per process, cached across hot reloads and warm
 * serverless instances so each rendering does not open a fresh pool.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.ts';

export type Database = ReturnType<typeof createDatabase>;

export interface DatabaseOptions {
  url: string;
  /** Serverless runtimes get a small pool; a long-lived server can hold more. */
  max?: number;
  ssl?: boolean;
}

/** Default pool size: one connection per instance is enough behind a transaction pooler. */
const DEFAULT_MAX = 1;

export function createDatabase({ url, max = DEFAULT_MAX, ssl }: DatabaseOptions) {
  const client = postgres(url, {
    max,
    // Prepared statements break through connection poolers such as PgBouncer /
    // Supavisor in transaction mode.
    prepare: false,
    ...(ssl === undefined ? {} : { ssl: ssl ? 'require' : false }),
  });
  return drizzle(client, { schema, casing: 'snake_case' });
}

declare global {
  // eslint-disable-next-line no-var
  var __jobbdjungelnDb: Database | undefined;
  // eslint-disable-next-line no-var
  var __jobbdjungelnDbUrl: string | undefined;
}

/**
 * The shared instance.
 *
 * Always reuse the pool — including in production on Vercel. Creating a new
 * postgres.js client per `db()` call exhausts Supavisor’s client limit and
 * takes the whole site down.
 */
export function getDatabase(url: string, options: Omit<DatabaseOptions, 'url'> = {}): Database {
  if (globalThis.__jobbdjungelnDb && globalThis.__jobbdjungelnDbUrl === url) {
    return globalThis.__jobbdjungelnDb;
  }
  globalThis.__jobbdjungelnDbUrl = url;
  globalThis.__jobbdjungelnDb = createDatabase({ url, ...options });
  return globalThis.__jobbdjungelnDb;
}

export { schema };
