'use server';

import { schema } from '@jobbdjungeln/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { type ActionResult, fail, fromZod, ok } from './result.ts';
import { savedSearchSchema } from './schemas.ts';

const MAX_SAVED_SEARCHES = 25;

export type SavedSearchSnapshot = {
  id: string;
  label: string;
  query: string;
  regions: string[];
  municipalities: string[];
  occupationFields: string[];
  occupationGroups: string[];
  remote: boolean;
  matchCv: boolean;
  digestOptIn: boolean;
  lastRunAt: string | null;
};

function toSnapshot(row: typeof schema.savedSearches.$inferSelect): SavedSearchSnapshot {
  return {
    id: row.id,
    label: row.label,
    query: row.query,
    regions: row.regions,
    municipalities: row.municipalities,
    occupationFields: row.occupationFields,
    occupationGroups: row.occupationGroups,
    remote: row.remote,
    matchCv: row.matchCv,
    digestOptIn: row.digestOptIn,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
  };
}

export async function saveSearchAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = savedSearchSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { id, ...values } = parsed.data;

  if (id) {
    const [row] = await db()
      .update(schema.savedSearches)
      .set(values)
      .where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, user.id)))
      .returning({ id: schema.savedSearches.id });
    if (!row) return fail('Sökningen finns inte.');
    revalidatePath('/annonser');
    return ok({ id: row.id });
  }

  const existing = await db()
    .select({ id: schema.savedSearches.id })
    .from(schema.savedSearches)
    .where(eq(schema.savedSearches.userId, user.id));
  if (existing.length >= MAX_SAVED_SEARCHES) {
    return fail(`Du kan spara högst ${MAX_SAVED_SEARCHES} sökningar. Ta bort en först.`);
  }

  const now = new Date();
  const [row] = await db()
    .insert(schema.savedSearches)
    .values({ userId: user.id, ...values, lastRunAt: now })
    .returning({ id: schema.savedSearches.id });
  if (!row) return fail('Kunde inte spara sökningen.');

  revalidatePath('/annonser');
  return ok({ id: row.id });
}

export async function deleteSearchAction(
  id: string,
): Promise<ActionResult<SavedSearchSnapshot>> {
  const user = await requireUser();
  const [row] = await db()
    .delete(schema.savedSearches)
    .where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, user.id)))
    .returning();
  if (!row) return fail('Sökningen finns inte.');
  revalidatePath('/annonser');
  return ok(toSnapshot(row));
}

/** Recreate a search after undo — keeps the previous id when possible. */
export async function restoreSearchAction(
  snapshot: SavedSearchSnapshot,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const existing = await db()
    .select({ id: schema.savedSearches.id })
    .from(schema.savedSearches)
    .where(eq(schema.savedSearches.userId, user.id));
  if (existing.length >= MAX_SAVED_SEARCHES) {
    return fail(`Du kan spara högst ${MAX_SAVED_SEARCHES} sökningar. Ta bort en först.`);
  }

  const [row] = await db()
    .insert(schema.savedSearches)
    .values({
      id: snapshot.id,
      userId: user.id,
      label: snapshot.label,
      query: snapshot.query,
      regions: snapshot.regions,
      municipalities: snapshot.municipalities,
      occupationFields: snapshot.occupationFields,
      occupationGroups: snapshot.occupationGroups,
      remote: snapshot.remote,
      matchCv: snapshot.matchCv,
      digestOptIn: snapshot.digestOptIn,
      lastRunAt: snapshot.lastRunAt ? new Date(snapshot.lastRunAt) : null,
    })
    .returning({ id: schema.savedSearches.id });
  if (!row) return fail('Kunde inte återställa sökningen.');

  revalidatePath('/annonser');
  return ok({ id: row.id });
}

/** Mark a saved search as run now (resets the "N nya" counter). */
export async function touchSavedSearchAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const [row] = await db()
    .update(schema.savedSearches)
    .set({ lastRunAt: new Date() })
    .where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, user.id)))
    .returning({ id: schema.savedSearches.id });
  if (!row) return fail('Sökningen finns inte.');
  revalidatePath('/annonser');
  return ok();
}
