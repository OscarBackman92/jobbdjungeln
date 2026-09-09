'use server';

import {
  employerKey,
  isTransitionAllowed,
  isValidSalaryClaim,
  normalizeAdUrl,
  requiresSalaryClaim,
  roleKey,
  STATUS_LABELS,
  salaryClaimMissingOnApply,
  stageForStatus,
  today as todayIso,
} from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/session';
import {
  addEvent,
  createApplication,
  derivedColumns,
  getApplication,
} from '@/server/applications';
import { type ActionResult, fail, fromZod, ok } from './result.ts';
import {
  addEventSchema,
  bulkSchema,
  changeStatusSchema,
  createApplicationSchema,
  updateApplicationSchema,
} from './schemas.ts';

/** Refresh every screen that shows tracker rows. */
function revalidateBoards(): void {
  revalidatePath('/oversikt');
  revalidatePath('/sparade');
  revalidatePath('/ansokningar');
  revalidatePath('/rapport');
}

export async function createApplicationAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const parsed = createApplicationSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const values = parsed.data;

  if (salaryClaimMissingOnApply({ status: values.status, salaryClaim: values.salaryClaim })) {
    return fail('Ange löneanspråk när du markerar som ansökt.', {
      salaryClaim: 'Ange löneanspråk när du markerar som ansökt.',
    });
  }
  if (
    requiresSalaryClaim(values.status) &&
    values.salaryClaim.trim() &&
    !isValidSalaryClaim(values.salaryClaim)
  ) {
    return fail('Ange ett giltigt löneanspråk.', {
      salaryClaim: 'Ange ett belopp med siffror, eller „Angav ingen lön”.',
    });
  }

  // The unique index is the real guard; this turns it into a useful message.
  const adUrlKey = normalizeAdUrl(values.adUrl);
  if (adUrlKey) {
    const [existing] = await db()
      .select({ id: schema.applications.id })
      .from(schema.applications)
      .where(
        and(
          eq(schema.applications.userId, user.id),
          eq(schema.applications.adUrlKey, adUrlKey),
        ),
      )
      .limit(1);
    if (existing) return fail('Du spårar redan den här annonsen.', { adUrl: 'Redan sparad.' });
  }

  // Manual entries often lack an ad URL — catch company+title duplicates too.
  const eKey = employerKey(values.company);
  const rKey = roleKey(values.title);
  if (eKey && rKey) {
    const candidates = await db()
      .select({
        id: schema.applications.id,
        title: schema.applications.title,
      })
      .from(schema.applications)
      .where(
        and(
          eq(schema.applications.userId, user.id),
          eq(schema.applications.employerKey, eKey),
          isNull(schema.applications.archivedAt),
        ),
      )
      .limit(25);
    const duplicate = candidates.find((row) => roleKey(row.title) === rKey);
    if (duplicate) {
      return fail('Du har redan sparat det här jobbet.', {
        title: 'Öppna den sparade raden i stället.',
      });
    }
  }

  const row = await createApplication(user.id, values);
  if (!row) return fail('Kunde inte spara raden.');

  if (stageForStatus(values.status) !== 'bevakad') {
    await addEvent(user.id, row.id, {
      occurredAt: row.appliedAt ?? todayIso(),
      note: `Sökt jobbet (${STATUS_LABELS[values.status]})`,
      eventType: 'status',
      status: values.status,
      toStage: stageForStatus(values.status),
      origin: 'auto',
      isReportable: false,
    });
  }

  revalidateBoards();
  return ok({ id: row.id });
}

export async function updateApplicationAction(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  const parsed = updateApplicationSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { id, ...values } = parsed.data;

  const existing = await getApplication(user.id, id);
  if (!existing) return fail('Raden finns inte.');

  const status = values.status ?? existing.status;
  if (values.status && !isTransitionAllowed(existing.status, values.status)) {
    return fail(
      `Går inte att gå från ${STATUS_LABELS[existing.status]} till ${STATUS_LABELS[values.status]}.`,
      { status: 'Otillåten övergång.' },
    );
  }

  const company = values.company ?? existing.company;
  const derived = derivedColumns(status, company, existing.furthestStage);

  await db()
    .update(schema.applications)
    .set({
      ...values,
      ...(values.adUrl === undefined ? {} : { adUrlKey: normalizeAdUrl(values.adUrl) }),
      ...derived,
      // Once the user picks a date themselves, we stop moving it for them.
      ...(values.applyBy === undefined ? {} : { applyByIsAuto: false }),
    })
    .where(and(eq(schema.applications.id, id), eq(schema.applications.userId, user.id)));

  revalidateBoards();
  revalidatePath(`/ansokningar/${id}`);
  return ok();
}

/**
 * Move a row to a new status.
 *
 * The transition is checked, the salary claim is collected at the moment of
 * applying, and the change writes itself into the timeline — so the history is
 * never something the user has to remember to record.
 */
export async function changeStatusAction(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { id, status, salaryClaim, note } = parsed.data;

  const existing = await getApplication(user.id, id);
  if (!existing) return fail('Raden finns inte.');
  if (existing.status === status) return ok();

  if (!isTransitionAllowed(existing.status, status)) {
    return fail(
      `Går inte att gå från ${STATUS_LABELS[existing.status]} till ${STATUS_LABELS[status]}.`,
    );
  }

  const claim = salaryClaim?.trim() || existing.salaryClaim;
  if (salaryClaim?.trim() && !isValidSalaryClaim(salaryClaim)) {
    return fail('Ange ett giltigt löneanspråk.', {
      salaryClaim: 'Ange ett belopp med siffror, eller „Angav ingen lön”.',
    });
  }
  if (
    salaryClaimMissingOnApply({ status, salaryClaim: claim, previousStatus: existing.status })
  ) {
    return fail('Ange löneanspråk när du markerar som ansökt.', {
      salaryClaim: 'Ange löneanspråk när du markerar som ansökt.',
    });
  }

  const today = todayIso();
  const derived = derivedColumns(status, existing.company, existing.furthestStage);
  const becameApplication =
    stageForStatus(existing.status) === 'bevakad' && stageForStatus(status) !== 'bevakad';

  await db()
    .update(schema.applications)
    .set({
      status,
      ...derived,
      ...(requiresSalaryClaim(status) ? { salaryClaim: claim } : {}),
      ...(becameApplication ? { appliedAt: existing.appliedAt ?? today } : {}),
    })
    .where(and(eq(schema.applications.id, id), eq(schema.applications.userId, user.id)));

  await addEvent(user.id, id, {
    occurredAt: today,
    note:
      note?.trim() || `Status: ${STATUS_LABELS[existing.status]} → ${STATUS_LABELS[status]}`,
    eventType: 'status',
    status,
    fromStage: existing.stage,
    toStage: derived.stage,
    origin: 'auto',
    // Internal status moves are not AF activities — only manual events count.
    isReportable: false,
  });

  revalidateBoards();
  revalidatePath(`/ansokningar/${id}`);
  return ok();
}

export async function addEventAction(input: unknown): Promise<ActionResult<void>> {
  const user = await requireUser();
  const parsed = addEventSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);

  const created = await addEvent(user.id, parsed.data.applicationId, {
    occurredAt: parsed.data.occurredAt,
    note: parsed.data.note,
    eventType: parsed.data.eventType,
    origin: 'manual',
    isReportable: parsed.data.eventType === 'intervju',
  });
  if (!created) return fail('Raden finns inte.');

  revalidateBoards();
  revalidatePath(`/ansokningar/${parsed.data.applicationId}`);
  return ok();
}

export async function deleteApplicationAction(id: string): Promise<ActionResult<void>> {
  const user = await requireUser();
  const result = await db()
    .delete(schema.applications)
    .where(and(eq(schema.applications.id, id), eq(schema.applications.userId, user.id)))
    .returning({ id: schema.applications.id });

  if (result.length === 0) return fail('Raden finns inte.');
  revalidateBoards();
  return ok();
}

/** Apply one change to a set of rows the user has selected. */
export async function bulkAction(input: unknown): Promise<ActionResult<{ affected: number }>> {
  const user = await requireUser();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fromZod(parsed.error);
  const { ids, action, applyBy, salaryClaim } = parsed.data;

  const scope = and(
    eq(schema.applications.userId, user.id),
    inArray(schema.applications.id, ids),
  );
  const today = todayIso();

  if (action === 'delete') {
    const deleted = await db()
      .delete(schema.applications)
      .where(scope)
      .returning({ id: schema.applications.id });
    revalidateBoards();
    return ok({ affected: deleted.length });
  }

  if (action === 'mark_applied') {
    const claim = salaryClaim?.trim() ?? '';
    if (!isValidSalaryClaim(claim)) {
      return fail('Ange löneanspråk när du markerar som ansökt.', {
        salaryClaim: 'Ange belopp eller „Angav ingen lön”.',
      });
    }
    const rows = await db()
      .update(schema.applications)
      .set({
        status: 'applied',
        stage: 'sokt',
        outcome: null,
        furthestStage: sql`greatest(${schema.applications.furthestStage}, 'sokt')`,
        appliedAt: sql`coalesce(${schema.applications.appliedAt}, ${today}::date)`,
        lastActivityAt: today,
        salaryClaim: claim,
        closedAt: null,
      })
      .where(and(scope, eq(schema.applications.stage, 'bevakad')))
      .returning({ id: schema.applications.id });

    for (const row of rows) {
      await addEvent(user.id, row.id, {
        occurredAt: today,
        note: 'Sökt jobbet',
        eventType: 'status',
        status: 'applied',
        toStage: 'sokt',
        origin: 'auto',
      });
    }
    revalidateBoards();
    return ok({ affected: rows.length });
  }

  const changes = {
    archive: { archivedAt: new Date() },
    unarchive: { archivedAt: null },
    pause: { intent: 'paused' as const },
    activate: { intent: 'active' as const },
    set_apply_by: { applyBy: applyBy ?? null, applyByIsAuto: false },
  }[action];

  const rows = await db()
    .update(schema.applications)
    .set(changes)
    .where(action === 'unarchive' ? scope : and(scope, isNull(schema.applications.archivedAt)))
    .returning({ id: schema.applications.id });

  revalidateBoards();
  return ok({ affected: rows.length });
}
