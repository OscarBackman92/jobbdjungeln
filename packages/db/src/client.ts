/**
 * Database client.
 *
 * One pooled connection per process, cached across hot reloads in development so
 * a file save does not leak a new pool on every edit.
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

export function createDatabase({ url, max = 10, ssl }: DatabaseOptions) {
  const client = postgres(url, {
    max,
    // Prepared statements break through connection poolers such as PgBouncer.
    prepare: false,
    ...(ssl === undefined ? {} : { ssl: ssl ? 'require' : false }),
  });
  return drizzle(client, { schema, casing: 'snake_case' });
}

declare global {
  // eslint-disable-next-line no-var
  var __jobbdjungelnDb: Database | undefined;
}

/** The shared instance. Reuses the pool across hot reloads in development. */
export function getDatabase(url: string): Database {
  if (process.env.NODE_ENV === 'production') {
    return createDatabase({ url });
  }
  globalThis.__jobbdjungelnDb ??= createDatabase({ url });
  return globalThis.__jobbdjungelnDb;
}

export { schema };
