import 'server-only';
import {
  type AppliedLane,
  appliedLaneFor,
  buildSummary,
  employerKey,
  type IsoDate,
  isFollowUpOverdue,
  isOverdue,
  type SavedLane,
  type Stage,
  type Status,
  savedLaneFor,
  today as todayIso,
  waitingDays,
} from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * Read models for the two board views and the dashboard.
 *
 * The database filters and sorts; the arithmetic is done by pure functions in
 * `@jobbdjungeln/core`, which is why every number on these screens can be tested
 * without a database.
 */

export interface BoardRow {
  id: string;
  company: string;
  title: string;
  location: string;
  status: Status;
  stage: Stage;
  intent: 'active' | 'paused';
  source: string | null;
  adUrl: string;
  applyUrl: string;
  appliedAt: IsoDate | null;
  deadline: IsoDate | null;
  applyBy: IsoDate | null;
  applyByIsAuto: boolean;
  nextActionAt: IsoDate | null;
  lastActivityAt: IsoDate | null;
  salaryClaim: string;
  contactName: string;
  notes: string;
  matchScore: number | null;
  archivedAt: Date | null;
  eventCount: number;
  /** Days without a reply, when the row is waiting for one. */
  waitingDays: number | null;
  overdue: boolean;
  followUpOverdue: boolean;
}

const rowColumns = {
  id: schema.applications.id,
  company: schema.applications.company,
  title: schema.applications.title,
  location: schema.applications.location,
  status: schema.applications.status,
  stage: schema.applications.stage,
  intent: schema.applications.intent,
  source: schema.applications.source,
  adUrl: schema.applications.adUrl,
  applyUrl: schema.applications.applyUrl,
  appliedAt: schema.applications.appliedAt,
  deadline: schema.applications.deadline,
  applyBy: schema.applications.applyBy,
  applyByIsAuto: schema.applications.applyByIsAuto,
  nextActionAt: schema.applications.nextActionAt,
  lastActivityAt: schema.applications.lastActivityAt,
  salaryClaim: schema.applications.salaryClaim,
  contactName: schema.applications.contactName,
  notes: schema.applications.notes,
  matchScore: schema.applications.matchScore,
  archivedAt: schema.applications.archivedAt,
  furthestStage: schema.applications.furthestStage,
  eventCount: sql<number>`(
    select count(*)::int from ${schema.applicationEvents}
    where ${schema.applicationEvents.applicationId} = ${schema.applications.id}
  )`.as('event_count'),
};

type RawRow = {
  [K in keyof typeof rowColumns]: K extends 'eventCount' ? number : never;
};

function decorate(
  row: Omit<BoardRow, 'waitingDays' | 'overdue' | 'followUpOverdue'> & {
    furthestStage?: Stage;
  },
  today: IsoDate,
): BoardRow {
  return {
    ...row,
    waitingDays: waitingDays(row, today),
    overdue: isOverdue(row, today),
    followUpOverdue: isFollowUpOverdue(row, today),
  };
}

export interface BoardFilters {
  search?: string;
  archived?: boolean;
}

function searchClause(search: string | undefined) {
  const term = search?.trim();
  if (!term) return undefined;
  const like = `%${term}%`;
  return or(
    ilike(schema.applications.company, like),
    ilike(schema.applications.title, like),
    ilike(schema.applications.location, like),
    ilike(schema.applications.notes, like),
  );
}

/** Saved jobs — the wishlist — grouped into urgency lanes. */
export async function savedBoard(
  userId: string,
  filters: BoardFilters = {},
  today: IsoDate = todayIso(),
): Promise<{ lanes: Record<SavedLane, BoardRow[]>; total: number }> {
  const rows = await db()
    .select(rowColumns)
    .from(schema.applications)
    .where(
      and(
        eq(schema.applications.userId, userId),
        eq(schema.applications.stage, 'bevakad'),
        filters.archived
          ? isNotNull(schema.applications.archivedAt)
          : isNull(schema.applications.archivedAt),
        searchClause(filters.search),
      ),
    )
    // Nulls last: a job with no deadline is not the most urgent one.
    .orderBy(
      sql`${schema.applications.applyBy} asc nulls last`,
      desc(schema.applications.createdAt),
    );

  const lanes: Record<SavedLane, BoardRow[]> = {
    utgangna: [],
    idag_imorgon: [],
    denna_vecka: [],
    senare_manad: [],
    langre_fram: [],
    utan_datum: [],
    pa_is: [],
  };

  for (const raw of rows as unknown as Array<Parameters<typeof decorate>[0]>) {
    const row = decorate(raw, today);
    lanes[savedLaneFor(row, today)].push(row);
  }

  return { lanes, total: rows.length };
}

/** Applications — everything past the wishlist — grouped by what needs doing. */
export async function appliedBoard(
  userId: string,
  filters: BoardFilters = {},
  today: IsoDate = todayIso(),
): Promise<{ lanes: Record<AppliedLane, BoardRow[]>; total: number }> {
  const rows = await db()
    .select(rowColumns)
    .from(schema.applications)
    .where(
      and(
        eq(schema.applications.userId, userId),
        sql`${schema.applications.stage} <> 'bevakad'`,
        filters.archived
          ? isNotNull(schema.applications.archivedAt)
          : isNull(schema.applications.archivedAt),
        searchClause(filters.search),
      ),
    )
    .orderBy(
      sql`${schema.applications.appliedAt} desc nulls last`,
      desc(schema.applications.createdAt),
    );

  const lanes: Record<AppliedLane, BoardRow[]> = {
    vantar_for_lange: [],
    nyligen_sokta: [],
    i_dialog: [],
    erbjudande: [],
    avslutade: [],
  };

  for (const raw of rows as unknown as Array<Parameters<typeof decorate>[0]>) {
    const row = decorate(raw, today);
    lanes[appliedLaneFor(row, today)].push(row);
  }

  return { lanes, total: rows.length };
}

/** Everything the dashboard needs, in one pass over the user's rows. */
export async function dashboard(userId: string, today: IsoDate = todayIso()) {
  const rows = await db()
    .select({
      id: schema.applications.id,
      company: schema.applications.company,
      title: schema.applications.title,
      status: schema.applications.status,
      intent: schema.applications.intent,
      appliedAt: schema.applications.appliedAt,
      applyBy: schema.applications.applyBy,
      applyByIsAuto: schema.applications.applyByIsAuto,
      deadline: schema.applications.deadline,
      nextActionAt: schema.applications.nextActionAt,
      lastActivityAt: schema.applications.lastActivityAt,
      archivedAt: schema.applications.archivedAt,
      furthestStage: schema.applications.furthestStage,
    })
    .from(schema.applications)
    .where(eq(schema.applications.userId, userId))
    .orderBy(asc(schema.applications.createdAt));

  const furthestStageById = new Map(rows.map((row) => [row.id, row.furthestStage]));
  return buildSummary({ rows, furthestStageById, today });
}

/** Rows that look like a duplicate of one already tracked, by employer and title. */
export async function similarApplications(userId: string, company: string, title: string) {
  // The stored key already has company forms stripped, so "Acme AB" finds
  // "Acme Aktiebolag".
  const key = employerKey(company);
  if (!key) return [];
  return db()
    .select({
      id: schema.applications.id,
      company: schema.applications.company,
      title: schema.applications.title,
      status: schema.applications.status,
      appliedAt: schema.applications.appliedAt,
    })
    .from(schema.applications)
    .where(
      and(
        eq(schema.applications.userId, userId),
        eq(schema.applications.employerKey, key),
        ilike(schema.applications.title, `%${title.trim()}%`),
      ),
    )
    .limit(5);
}

export type { RawRow };
