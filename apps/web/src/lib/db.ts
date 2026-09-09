import 'server-only';
import { getDatabase } from '@jobbdjungeln/db';
import { env } from './env.ts';

/** The shared database handle. */
export function db() {
  return getDatabase(env().DATABASE_URL);
}
