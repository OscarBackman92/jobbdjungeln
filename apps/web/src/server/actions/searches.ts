'use server';

import { schema } from '@jobbdjungeln/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { type ActionResult, fail, fromZod, ok } from './result.ts';
import { savedSearchSchema } from './schemas.ts';

const MAX_SAVED_SEARCHES = 25;

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

  const [row] = await db()
    .insert(schema.savedSearches)
    .values({ userId: user.id, ...values })
    .returning({ id: schema.savedSearches.id });
  if (!row) return fail('Kunde inte spara sökningen.');

  revalidatePath('/annonser');
  return ok({ id: row.id });
}

export async function deleteSearchAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const rows = await db()
    .delete(schema.savedSearches)
    .where(and(eq(schema.savedSearches.id, id), eq(schema.savedSearches.userId, user.id)))
    .returning({ id: schema.savedSearches.id });
  if (rows.length === 0) return fail('Sökningen finns inte.');
  revalidatePath('/annonser');
  return ok();
}
