'use server';

import { schema } from '@jobbdjungeln/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { type ActionResult, fromZod, ok } from './result.ts';
import { profileSchema } from './schemas.ts';

export async function updateProfileAction(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);

  await db().update(schema.users).set(parsed.data).where(eq(schema.users.id, user.id));
  revalidatePath('/profil');
  return ok();
}
