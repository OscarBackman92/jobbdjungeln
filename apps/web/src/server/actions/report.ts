'use server';

import { isAfPlanActivity, parsePeriodKey, periodBounds, today as todayIso } from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { and, between, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import { type ActionResult, fail, fromZod, ok } from './result.ts';
import { activitySchema, periodKeySchema } from './schemas.ts';

async function periodRow(userId: string, key: string) {
  const parts = parsePeriodKey(key);
  if (!parts) return null;
  const [row] = await db()
    .insert(schema.reportPeriods)
    .values({ userId, year: parts.year, month: parts.month })
    .onConflictDoUpdate({
      target: [
        schema.reportPeriods.userId,
        schema.reportPeriods.year,
        schema.reportPeriods.month,
      ],
      // A no-op update is how the row comes back on conflict.
      set: { updatedAt: new Date() },
    })
    .returning();
  return row ?? null;
}

/**
 * Mark a month as handed in.
 *
 * Idempotent, and it stamps every unreported row in the month as belonging to
 * this period — so a row cannot silently end up in two monthly reports.
 */
export async function submitPeriodAction(key: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const parsed = periodKeySchema.safeParse(key);
  if (!parsed.success) return fromZod(parsed.error);

  const period = await periodRow(user.id, parsed.data);
  if (!period) return fail('Månaden finns inte.');

  const { start, end } = periodBounds(period.year, period.month);

  if (!period.submittedAt) {
    await db()
      .update(schema.reportPeriods)
      .set({ submittedAt: new Date() })
      .where(eq(schema.reportPeriods.id, period.id));
  }

  await db()
    .update(schema.applications)
    .set({ reportedInId: period.id })
    .where(
      and(
        eq(schema.applications.userId, user.id),
        isNull(schema.applications.reportedInId),
        eq(schema.applications.reportExcluded, false),
        between(schema.applications.appliedAt, start, end),
      ),
    );

  await db()
    .update(schema.activities)
    .set({ reportedInId: period.id })
    .where(
      and(
        eq(schema.activities.userId, user.id),
        isNull(schema.activities.reportedInId),
        eq(schema.activities.reportExcluded, false),
        between(schema.activities.occurredOn, start, end),
      ),
    );

  revalidatePath('/rapport');
  return ok();
}

export async function reopenPeriodAction(key: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const parsed = periodKeySchema.safeParse(key);
  if (!parsed.success) return fromZod(parsed.error);

  const parts = parsePeriodKey(parsed.data);
  if (!parts) return fail('Ogiltig månad.');

  await db()
    .update(schema.reportPeriods)
    .set({ submittedAt: null })
    .where(
      and(
        eq(schema.reportPeriods.userId, user.id),
        eq(schema.reportPeriods.year, parts.year),
        eq(schema.reportPeriods.month, parts.month),
      ),
    );

  revalidatePath('/rapport');
  return ok();
}

const excludeSchema = z.object({
  kind: z.enum(['job', 'event', 'activity']),
  id: z.string().min(1),
  excluded: z.boolean(),
  note: z.string().trim().max(255).default(''),
});

/** Leave a single row out of the month's report, with an optional reason. */
export async function toggleReportExclusionAction(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  const parsed = excludeSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { kind, id, excluded, note } = parsed.data;

  if (kind === 'job') {
    await db()
      .update(schema.applications)
      .set({ reportExcluded: excluded, reportNote: note })
      .where(and(eq(schema.applications.id, id), eq(schema.applications.userId, user.id)));
  } else if (kind === 'activity') {
    await db()
      .update(schema.activities)
      .set({ reportExcluded: excluded, reportNote: note })
      .where(and(eq(schema.activities.id, id), eq(schema.activities.userId, user.id)));
  } else {
    // Events are owned through their application, so scope by the join.
    const [event] = await db()
      .select({ id: schema.applicationEvents.id })
      .from(schema.applicationEvents)
      .innerJoin(
        schema.applications,
        eq(schema.applicationEvents.applicationId, schema.applications.id),
      )
      .where(and(eq(schema.applicationEvents.id, id), eq(schema.applications.userId, user.id)))
      .limit(1);
    if (!event) return fail('Raden finns inte.');
    await db()
      .update(schema.applicationEvents)
      .set({ reportExcluded: excluded })
      .where(eq(schema.applicationEvents.id, id));
  }

  revalidatePath('/rapport');
  return ok();
}

export async function saveActivityAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = activitySchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { id, applicationId, afOutcome, ...values } = parsed.data;

  // An activity may reference an application, but only one the user owns.
  let linked: string | null = null;
  if (applicationId) {
    const [row] = await db()
      .select({ id: schema.applications.id })
      .from(schema.applications)
      .where(
        and(eq(schema.applications.id, applicationId), eq(schema.applications.userId, user.id)),
      )
      .limit(1);
    linked = row?.id ?? null;
  }

  const occurredOn = values.occurredOn;
  const [activityYear, activityMonth] = occurredOn.split('-').map(Number) as [number, number];
  if (activityYear && activityMonth) {
    await periodRow(user.id, `${activityYear}-${`${activityMonth}`.padStart(2, '0')}`);
  }

  const outcome = isAfPlanActivity(values.type) ? (afOutcome ?? null) : null;

  if (id) {
    const [row] = await db()
      .update(schema.activities)
      .set({ ...values, applicationId: linked, afOutcome: outcome })
      .where(and(eq(schema.activities.id, id), eq(schema.activities.userId, user.id)))
      .returning({ id: schema.activities.id });
    if (!row) return fail('Aktiviteten finns inte.');
    revalidatePath('/rapport');
    return ok({ id: row.id });
  }

  const [row] = await db()
    .insert(schema.activities)
    .values({ userId: user.id, ...values, applicationId: linked, afOutcome: outcome })
    .returning({ id: schema.activities.id });
  if (!row) return fail('Kunde inte spara aktiviteten.');

  revalidatePath('/rapport');
  return ok({ id: row.id });
}

export async function deleteActivityAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const rows = await db()
    .delete(schema.activities)
    .where(and(eq(schema.activities.id, id), eq(schema.activities.userId, user.id)))
    .returning({ id: schema.activities.id });
  if (rows.length === 0) return fail('Aktiviteten finns inte.');
  revalidatePath('/rapport');
  return ok();
}

export async function savePeriodNoteAction(
  key: string,
  note: string,
): Promise<ActionResult<void>> {
  const user = await requireUser();
  const parsed = periodKeySchema.safeParse(key);
  if (!parsed.success) return fromZod(parsed.error);
  const parts = parsePeriodKey(parsed.data);
  if (!parts) return fail('Ogiltig månad.');

  await periodRow(user.id, parsed.data);
  await db()
    .update(schema.reportPeriods)
    .set({ note: note.slice(0, 2000) })
    .where(
      and(
        eq(schema.reportPeriods.userId, user.id),
        eq(schema.reportPeriods.year, parts.year),
        eq(schema.reportPeriods.month, parts.month),
      ),
    );

  revalidatePath('/rapport');
  return ok();
}

export { todayIso };
