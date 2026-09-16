import 'server-only';
import {
  ACTIVITY_TYPE_LABELS,
  AF_OUTCOME_LABELS,
  type ActivityType,
  answeredAdLabel,
  type IsoDate,
  type PeriodStatus,
  parsePeriodKey,
  periodBanner,
  periodBounds,
  periodKey,
  periodLabel,
  periodStatus,
  type ReportRow,
  reportingWindow,
  today as todayIso,
} from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { and, asc, between, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';

/**
 * The monthly activity report.
 *
 * Arbetsförmedlingen wants a list of what you did in a calendar month. This
 * builds it from what is already in the tracker, so nothing has to be typed
 * twice. It is a personal aid — the app does not talk to any authority.
 */

export interface PeriodSummary {
  key: string;
  year: number;
  month: number;
  label: string;
  status: PeriodStatus;
  windowOpens: IsoDate;
  windowCloses: IsoDate;
  submittedAt: Date | null;
  jobCount: number;
  activityCount: number;
  missingOccupationCount: number;
  note: string;
  banner: string | null;
}

export interface PeriodDetail extends PeriodSummary {
  rows: ReportRow[];
  excludedRows: ReportRow[];
}

/** Ensure a period row exists for every month with activity, plus this one. */
export async function ensurePeriods(
  userId: string,
  today: IsoDate = todayIso(),
): Promise<void> {
  const [fromJobs, fromActivities, fromEvents] = await Promise.all([
    db()
      .selectDistinct({
        year: sql<number>`extract(year from ${schema.applications.appliedAt})::int`,
        month: sql<number>`extract(month from ${schema.applications.appliedAt})::int`,
      })
      .from(schema.applications)
      .where(
        and(
          eq(schema.applications.userId, userId),
          sql`${schema.applications.appliedAt} is not null`,
        ),
      ),
    db()
      .selectDistinct({
        year: sql<number>`extract(year from ${schema.activities.occurredOn})::int`,
        month: sql<number>`extract(month from ${schema.activities.occurredOn})::int`,
      })
      .from(schema.activities)
      .where(eq(schema.activities.userId, userId)),
    db()
      .selectDistinct({
        year: sql<number>`extract(year from ${schema.applicationEvents.occurredAt})::int`,
        month: sql<number>`extract(month from ${schema.applicationEvents.occurredAt})::int`,
      })
      .from(schema.applicationEvents)
      .innerJoin(
        schema.applications,
        eq(schema.applicationEvents.applicationId, schema.applications.id),
      )
      .where(
        and(
          eq(schema.applications.userId, userId),
          eq(schema.applicationEvents.isReportable, true),
        ),
      ),
  ]);

  const [thisYear, thisMonth] = today.split('-').map(Number) as [number, number];
  const wanted = new Map<string, { year: number; month: number }>();
  for (const batch of [fromJobs, fromActivities, fromEvents]) {
    for (const m of batch) {
      if (m.year && m.month) wanted.set(`${m.year}-${m.month}`, m);
    }
  }
  wanted.set(`${thisYear}-${thisMonth}`, { year: thisYear, month: thisMonth });

  if (wanted.size === 0) return;
  await db()
    .insert(schema.reportPeriods)
    .values([...wanted.values()].map((m) => ({ userId, year: m.year, month: m.month })))
    .onConflictDoNothing();
}

async function counts(userId: string, year: number, month: number) {
  const { start, end } = periodBounds(year, month);
  const database = db();

  const [[jobs], [activities], [events]] = await Promise.all([
    database
      .select({
        total: sql<number>`count(*)::int`,
        included: sql<number>`count(*) filter (where ${schema.applications.reportExcluded} = false)::int`,
        // The label, not the concept id: the label is what the table prints in
        // the Yrkesroll column, and a row that shows a role must not also be
        // counted as missing one.
        missing: sql<number>`count(*) filter (where ${schema.applications.reportExcluded} = false and ${schema.applications.occupationLabel} = '')::int`,
      })
      .from(schema.applications)
      .where(
        and(
          eq(schema.applications.userId, userId),
          isNull(schema.applications.archivedAt),
          between(schema.applications.appliedAt, start, end),
        ),
      ),
    database
      .select({ included: sql<number>`count(*)::int` })
      .from(schema.activities)
      .where(
        and(
          eq(schema.activities.userId, userId),
          eq(schema.activities.reportExcluded, false),
          between(schema.activities.occurredOn, start, end),
        ),
      ),
    database
      .select({ included: sql<number>`count(*)::int` })
      .from(schema.applicationEvents)
      .innerJoin(
        schema.applications,
        eq(schema.applicationEvents.applicationId, schema.applications.id),
      )
      .where(
        and(
          eq(schema.applications.userId, userId),
          eq(schema.applicationEvents.isReportable, true),
          eq(schema.applicationEvents.reportExcluded, false),
          between(schema.applicationEvents.occurredAt, start, end),
        ),
      ),
  ]);

  return {
    jobCount: jobs?.total ?? 0,
    includedJobs: jobs?.included ?? 0,
    missingOccupationCount: jobs?.missing ?? 0,
    activityCount: (activities?.included ?? 0) + (events?.included ?? 0),
  };
}

function summarize(
  period: { year: number; month: number; submittedAt: Date | null; note: string },
  totals: Awaited<ReturnType<typeof counts>>,
  today: IsoDate,
): PeriodSummary {
  const status = periodStatus(period, today);
  const { opens, closes } = reportingWindow(period.year, period.month);
  return {
    key: periodKey(period.year, period.month),
    year: period.year,
    month: period.month,
    label: periodLabel(period.year, period.month),
    status,
    windowOpens: opens,
    windowCloses: closes,
    submittedAt: period.submittedAt,
    jobCount: totals.jobCount,
    activityCount: totals.activityCount,
    missingOccupationCount: totals.missingOccupationCount,
    note: period.note,
    banner: periodBanner({
      year: period.year,
      month: period.month,
      status,
      jobCount: totals.jobCount,
      activityCount: totals.activityCount,
    }),
  };
}

export async function listPeriods(
  userId: string,
  today: IsoDate = todayIso(),
): Promise<PeriodSummary[]> {
  await ensurePeriods(userId, today);
  const periods = await db()
    .select()
    .from(schema.reportPeriods)
    .where(eq(schema.reportPeriods.userId, userId))
    .orderBy(sql`${schema.reportPeriods.year} desc`, sql`${schema.reportPeriods.month} desc`);

  return Promise.all(
    periods.map(async (period) =>
      summarize(period, await counts(userId, period.year, period.month), today),
    ),
  );
}

/** One activity as a report row. */
function activityRow(activity: {
  id: string;
  type: string;
  occurredOn: string;
  title: string;
  organisation: string;
  afOutcome: string | null;
}): ReportRow {
  const type = activity.type as ActivityType;
  const outcomeLabel =
    activity.afOutcome === 'genomford' || activity.afOutcome === 'ej_genomford'
      ? AF_OUTCOME_LABELS[activity.afOutcome]
      : null;
  return {
    kind: 'activity',
    id: activity.id,
    datum: activity.occurredOn,
    typ: ACTIVITY_TYPE_LABELS[type] ?? activity.type,
    yrke: '',
    arbetsgivare: activity.organisation,
    omfattning: '',
    ort: '',
    svarade: '',
    lank: '',
    anteckning: outcomeLabel ? `${activity.title} · ${outcomeLabel}` : activity.title,
    // An activity has no occupation to be missing.
    missingOccupation: false,
    dateWarning: null,
    applicationId: null,
    activityType: ACTIVITY_TYPE_LABELS[type] ? type : null,
    afOutcome:
      activity.afOutcome === 'genomford' || activity.afOutcome === 'ej_genomford'
        ? activity.afOutcome
        : null,
  };
}

/** Build the rows the user pastes into AF's form, or exports as CSV. */
export async function reportRows(
  userId: string,
  year: number,
  month: number,
  { excluded = false }: { excluded?: boolean } = {},
): Promise<ReportRow[]> {
  const { start, end } = periodBounds(year, month);
  const rows: ReportRow[] = [];
  const database = db();

  const jobs = await database
    .select()
    .from(schema.applications)
    .where(
      and(
        eq(schema.applications.userId, userId),
        isNull(schema.applications.archivedAt),
        eq(schema.applications.reportExcluded, excluded),
        between(schema.applications.appliedAt, start, end),
      ),
    )
    .orderBy(asc(schema.applications.appliedAt), asc(schema.applications.id));

  for (const job of jobs) {
    rows.push({
      kind: 'job',
      id: job.id,
      datum: job.appliedAt ?? '',
      typ: 'Sökt jobb',
      yrke: job.occupationLabel,
      arbetsgivare: job.company,
      omfattning: job.workingHoursType,
      ort: job.location,
      svarade: answeredAdLabel(job.source),
      lank: job.adUrl,
      anteckning: job.title,
      missingOccupation: !job.occupationLabel,
      dateWarning: null,
      applicationId: job.id,
      activityType: null,
      afOutcome: null,
    });
  }

  if (jobs.length > 0 && !excluded) {
    const earlyEvents = await database
      .select({
        applicationId: schema.applicationEvents.applicationId,
        occurredAt: schema.applicationEvents.occurredAt,
        eventType: schema.applicationEvents.eventType,
      })
      .from(schema.applicationEvents)
      .where(
        and(
          eq(schema.applicationEvents.reportExcluded, false),
          inArray(
            schema.applicationEvents.applicationId,
            jobs.map((job) => job.id),
          ),
          inArray(schema.applicationEvents.eventType, ['intervju', 'samtal']),
        ),
      );

    const earliestByApp = new Map<string, { date: string; label: string }>();
    for (const event of earlyEvents) {
      const label = event.eventType === 'intervju' ? 'intervju' : 'kontakt';
      const existing = earliestByApp.get(event.applicationId);
      if (!existing || event.occurredAt < existing.date) {
        earliestByApp.set(event.applicationId, { date: event.occurredAt, label });
      }
    }

    for (const row of rows) {
      if (row.kind !== 'job' || !row.datum) continue;
      const early = earliestByApp.get(row.id);
      if (early && row.datum > early.date) {
        row.dateWarning = `Sökt-datum efter ${early.label} – stämmer det?`;
      }
    }
  }

  // Excluded activities have to come back too, or leaving one out of the report
  // would be a one-way door. Events carry no exclusion list of their own here:
  // they are excluded through the application they belong to.
  if (excluded) {
    const hidden = await database
      .select()
      .from(schema.activities)
      .where(
        and(
          eq(schema.activities.userId, userId),
          eq(schema.activities.reportExcluded, true),
          between(schema.activities.occurredOn, start, end),
        ),
      )
      .orderBy(asc(schema.activities.occurredOn));

    for (const activity of hidden) {
      rows.push(activityRow(activity));
    }
    return rows.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
  }

  const [events, activities] = await Promise.all([
    database
      .select({
        id: schema.applicationEvents.id,
        applicationId: schema.applicationEvents.applicationId,
        occurredAt: schema.applicationEvents.occurredAt,
        note: schema.applicationEvents.note,
        eventType: schema.applicationEvents.eventType,
        company: schema.applications.company,
        location: schema.applications.location,
        occupationLabel: schema.applications.occupationLabel,
        workingHoursType: schema.applications.workingHoursType,
        source: schema.applications.source,
        adUrl: schema.applications.adUrl,
      })
      .from(schema.applicationEvents)
      .innerJoin(
        schema.applications,
        eq(schema.applicationEvents.applicationId, schema.applications.id),
      )
      .where(
        and(
          eq(schema.applications.userId, userId),
          eq(schema.applicationEvents.isReportable, true),
          eq(schema.applicationEvents.reportExcluded, false),
          between(schema.applicationEvents.occurredAt, start, end),
        ),
      )
      .orderBy(asc(schema.applicationEvents.occurredAt)),
    database
      .select()
      .from(schema.activities)
      .where(
        and(
          eq(schema.activities.userId, userId),
          eq(schema.activities.reportExcluded, false),
          between(schema.activities.occurredOn, start, end),
        ),
      )
      .orderBy(asc(schema.activities.occurredOn)),
  ]);

  for (const event of events) {
    rows.push({
      kind: 'event',
      id: event.id,
      datum: event.occurredAt,
      typ: event.eventType === 'intervju' ? 'Intervju' : 'Händelse',
      yrke: event.occupationLabel,
      arbetsgivare: event.company,
      omfattning: event.workingHoursType,
      ort: event.location,
      svarade: answeredAdLabel(event.source),
      lank: event.adUrl,
      anteckning: event.note,
      missingOccupation: false,
      dateWarning: null,
      applicationId: event.applicationId ?? null,
      activityType: null,
      afOutcome: null,
    });
  }

  for (const activity of activities) {
    rows.push(activityRow(activity));
  }

  return rows.sort((a, b) => (a.datum < b.datum ? -1 : a.datum > b.datum ? 1 : 0));
}

export async function periodDetail(
  userId: string,
  key: string,
  today: IsoDate = todayIso(),
): Promise<PeriodDetail | null> {
  const parts = parsePeriodKey(key);
  if (!parts) return null;
  await ensurePeriods(userId, today);

  const [period] = await db()
    .select()
    .from(schema.reportPeriods)
    .where(
      and(
        eq(schema.reportPeriods.userId, userId),
        eq(schema.reportPeriods.year, parts.year),
        eq(schema.reportPeriods.month, parts.month),
      ),
    )
    .limit(1);

  const base = period ?? { ...parts, submittedAt: null, note: '' };
  const [totals, rows, excludedRows] = await Promise.all([
    counts(userId, parts.year, parts.month),
    reportRows(userId, parts.year, parts.month),
    reportRows(userId, parts.year, parts.month, { excluded: true }),
  ]);

  return {
    ...summarize(base, totals, today),
    rows,
    excludedRows,
  };
}
