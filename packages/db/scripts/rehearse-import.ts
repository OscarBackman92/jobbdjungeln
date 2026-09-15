/**
 * Rehearse the Django import against a local scratch database.
 *
 * 1. pg_dump the live Django DB (custom format, --no-owner --no-acl). Never
 *    restore that dump into the new app's schema.
 * 2. Restore it to a local scratch Postgres used only as SOURCE_DATABASE_URL.
 * 3. Create a second empty database, run `pnpm db:migrate`, set DATABASE_URL.
 * 4. Run this script (dry-run, then --apply).
 *
 * Cutover (jobbdjungeln.obackman.se): new empty EU Postgres; freeze Render;
 * last dump; import; Vercel deploy + cron + DNS; password reset; leave old
 * Supabase untouched 14 days. Rollback = DNS back to Render.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const apply = process.argv.includes('--apply');
const script = fileURLToPath(new URL('./import-django.ts', import.meta.url));
const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', script, ...(apply ? [] : ['--dry-run'])],
  { stdio: 'inherit', env: process.env },
);
process.exit(result.status ?? 1);
