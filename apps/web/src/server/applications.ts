import 'server-only';
import {
  deriveApplyBy,
  employerKey,
  type IsoDate,
  isClosed,
  normalizeAdUrl,
  outcomeForStatus,
  type Status,
  stageForStatus,
  today as todayIso,
} from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * Writes to the tracker.
 *
 * Every function here takes the owner's id and scopes its query by it, so
 * ownership is enforced at the point of access rather than remembered by the
 * caller. There is no code path that reads or writes a row without it.
 */

/**
 * How far along the pipeline each stage is.
 *
 * "avslutad" is deliberately below everything: closing a row says how it ended,
 * not how far it got, and a rejection must not erase the fact that the person
 * reached an interview.
 */
const STAGE_RANK: Readonly<Record<string, number>> = {
  avslutad: -1,
  bevakad: 0,
  sokt: 1,
  kontakt: 2,
  intervju: 3,
  erbjudande: 4,
};

/** The furthest stage a row has reached — a closed row keeps how far it got. */
export function furthestStage(previous: string, next: string): string {
  return (STAGE_RANK[next] ?? 0) > (STAGE_RANK[previous] ?? 0) ? next : previous;
}

/**
 * Where a brand-new row starts on the pipeline. A row created as already
 * rejected still counts as applied for — that is how it came to be rejected.
 */
export function initialFurthestStage(status: Status): ReturnType<typeof stageForStatus> {
  const stage = stageForStatus(status);
  if (stage === 'avslutad') return 'sokt';
  return stage;
}

/** Columns derived from `status`, recomputed on every write so they cannot drift. */
export function derivedColumns(
  status: Status,
  company: string,
  previousFurthest = 'sokt',
): {
  stage: ReturnType<typeof stageForStatus>;
  outcome: ReturnType<typeof outcomeForStatus>;
  employerKey: string;
  furthestStage: ReturnType<typeof stageForStatus>;
  closedAt: Date | null;
} {
  const stage = stageForStatus(status);
  return {
    stage,
    outcome: outcomeForStatus(status),
    employerKey: employerKey(company),
    furthestStage: furthestStage(previousFurthest, stage) as ReturnType<typeof stageForStatus>,
    closedAt: isClosed(status) ? new Date() : null,
  };
}

export interface CreateApplicationInput {
  company: string;
  title: string;
  location?: string;
  status: Status;
  source?: 'platsbanken' | 'linkedin' | 'company' | 'recruiter' | 'other' | undefined;
  adUrl?: string;
  applyUrl?: string;
  adDescription?: string;
  sourceJobId?: string;
  appliedAt?: IsoDate | null;
  deadline?: IsoDate | null;
  applyBy?: IsoDate | null;
  nextActionAt?: IsoDate | null;
  salaryClaim?: string;
  contactName?: string;
  contactInfo?: string;
  notes?: string;
  occupationConceptId?: string;
  occupationLabel?: string;
  occupationGroupLabel?: string;
  workingHoursType?: string;
  scopeOfWorkMin?: number | null;
  scopeOfWorkMax?: number | null;
}

export async function createApplication(
  userId: string,
  input: CreateApplicationInput,
  today: IsoDate = todayIso(),
) {
  const derived = derivedColumns(
    input.status,
    input.company,
    initialFurthestStage(input.status),
  );
  const adUrlKey = normalizeAdUrl(input.adUrl ?? '');

  // A saved job gets a "search by" date; an applied one gets today's date.
  const applyBy =
    input.applyBy ??
    deriveApplyBy({ status: input.status, deadline: input.deadline ?? null, createdAt: today })
      ?.applyBy ??
    null;
  const appliedAt =
    input.appliedAt ?? (stageForStatus(input.status) === 'bevakad' ? null : today);

  const [row] = await db()
    .insert(schema.applications)
    .values({
      userId,
      company: input.company,
      title: input.title,
      location: input.location ?? '',
      adUrl: input.adUrl ?? '',
      adUrlKey,
      applyUrl: input.applyUrl ?? '',
      adDescription: input.adDescription ?? '',
      sourceJobId: input.sourceJobId ?? '',
      source: input.source ?? null,
      status: input.status,
      ...derived,
      applyBy,
      applyByIsAuto: input.applyBy == null,
      appliedAt,
      deadline: input.deadline ?? null,
      nextActionAt: input.nextActionAt ?? null,
      lastActivityAt: appliedAt,
      salaryClaim: input.salaryClaim ?? '',
      contactName: input.contactName ?? '',
      contactInfo: input.contactInfo ?? '',
      notes: input.notes ?? '',
      occupationConceptId: input.occupationConceptId ?? '',
      occupationLabel: input.occupationLabel ?? '',
      occupationGroupLabel: input.occupationGroupLabel ?? '',
      workingHoursType: input.workingHoursType ?? '',
      scopeOfWorkMin: input.scopeOfWorkMin ?? null,
      scopeOfWorkMax: input.scopeOfWorkMax ?? null,
    })
    .returning();

  return row;
}

/** One row, or null when it does not exist or belongs to somebody else. */
export async function getApplication(userId: string, id: string) {
  const [row] = await db()
    .select()
    .from(schema.applications)
    .where(and(eq(schema.applications.id, id), eq(schema.applications.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function getApplicationWithEvents(userId: string, id: string) {
  const row = await getApplication(userId, id);
  if (!row) return null;
  const events = await db()
    .select()
    .from(schema.applicationEvents)
    .where(eq(schema.applicationEvents.applicationId, id))
    .orderBy(
      desc(schema.applicationEvents.occurredAt),
      desc(schema.applicationEvents.createdAt),
    );
  return { ...row, events };
}

/** Append a timeline entry and move the row's "last activity" forward. */
export async function addEvent(
  userId: string,
  applicationId: string,
  event: {
    occurredAt: IsoDate;
    note: string;
    eventType?: string;
    status?: Status | null;
    fromStage?: string | null;
    toStage?: string | null;
    origin?: 'manual' | 'auto' | 'import';
    isReportable?: boolean;
  },
) {
  const application = await getApplication(userId, applicationId);
  if (!application) return null;

  const [row] = await db()
    .insert(schema.applicationEvents)
    .values({
      applicationId,
      occurredAt: event.occurredAt,
      note: event.note.slice(0, 500),
      eventType: event.eventType ?? '',
      status: event.status ?? null,
      fromStage: (event.fromStage as never) ?? null,
      toStage: (event.toStage as never) ?? null,
      origin: event.origin ?? 'manual',
      isReportable: event.isReportable ?? false,
    })
    .returning();

  await db()
    .update(schema.applications)
    .set({
      lastActivityAt: sql`greatest(coalesce(${schema.applications.lastActivityAt}, ${event.occurredAt}::date), ${event.occurredAt}::date)`,
    })
    .where(eq(schema.applications.id, applicationId));

  return row;
}

/** Every ad URL the user tracks, archived rows included — for duplicate warnings. */
export async function trackedAdUrls(userId: string): Promise<string[]> {
  const rows = await db()
    .select({ key: schema.applications.adUrlKey })
    .from(schema.applications)
    .where(
      and(eq(schema.applications.userId, userId), sql`${schema.applications.adUrlKey} <> ''`),
    );
  return rows.map((row) => row.key);
}

/** Rows the user has not archived. */
export function liveApplications(userId: string) {
  return and(eq(schema.applications.userId, userId), isNull(schema.applications.archivedAt));
}
