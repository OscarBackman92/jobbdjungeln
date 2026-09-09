import {
  type ApplicationSource,
  contentDisposition,
  type IsoDate,
  parsePeriodKey,
  periodLabel,
  REPORT_COLUMNS,
  SOURCE_LABELS,
  STATUS_LABELS,
  type Status,
  toCsv,
  today as todayIso,
  toIcs,
} from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser } from '@/lib/session';
import { reportRows } from '@/server/queries/report';

/**
 * Data export.
 *
 * CSV doubles as GDPR data portability, and the calendar file puts deadlines and
 * follow-ups where people actually look at them. Both are generated on demand;
 * nothing is stored.
 */

const APPLICATION_COLUMNS = [
  'Arbetsgivare',
  'Roll',
  'Ort',
  'Status',
  'Sökt datum',
  'Sista ansökningsdag',
  'Sök senast',
  'Följ upp',
  'Löneanspråk',
  'Kontaktperson',
  'Kontaktuppgift',
  'Hittad via',
  'Länk',
  'Anteckningar',
] as const;

async function applicationsCsv(userId: string): Promise<string> {
  const rows = await db()
    .select()
    .from(schema.applications)
    .where(eq(schema.applications.userId, userId))
    .orderBy(asc(schema.applications.appliedAt), asc(schema.applications.createdAt));

  return toCsv(
    APPLICATION_COLUMNS,
    rows.map((row) => [
      row.company,
      row.title,
      row.location,
      STATUS_LABELS[row.status as Status],
      row.appliedAt ?? '',
      row.deadline ?? '',
      row.applyBy ?? '',
      row.nextActionAt ?? '',
      row.salaryClaim,
      row.contactName,
      row.contactInfo,
      row.source ? SOURCE_LABELS[row.source as ApplicationSource] : '',
      row.adUrl,
      row.notes,
    ]),
  );
}

async function calendarIcs(userId: string): Promise<string> {
  const rows = await db()
    .select({
      id: schema.applications.id,
      company: schema.applications.company,
      title: schema.applications.title,
      applyBy: schema.applications.applyBy,
      deadline: schema.applications.deadline,
      nextActionAt: schema.applications.nextActionAt,
      adUrl: schema.applications.adUrl,
    })
    .from(schema.applications)
    .where(
      and(
        eq(schema.applications.userId, userId),
        isNull(schema.applications.archivedAt),
        or(
          eq(schema.applications.stage, 'bevakad'),
          eq(schema.applications.stage, 'sokt'),
          eq(schema.applications.stage, 'kontakt'),
          eq(schema.applications.stage, 'intervju'),
          eq(schema.applications.stage, 'erbjudande'),
        ),
      ),
    );

  const events = [];
  for (const row of rows) {
    const deadline = (row.deadline ?? row.applyBy) as IsoDate | null;
    if (deadline) {
      events.push({
        uid: `apply-${row.id}@jobbdjungeln`,
        date: deadline,
        summary: `Sök senast: ${row.title}, ${row.company}`,
        ...(row.adUrl ? { url: row.adUrl } : {}),
      });
    }
    if (row.nextActionAt) {
      events.push({
        uid: `followup-${row.id}@jobbdjungeln`,
        date: row.nextActionAt as IsoDate,
        summary: `Följ upp: ${row.title}, ${row.company}`,
        ...(row.adUrl ? { url: row.adUrl } : {}),
      });
    }
  }

  return toIcs(events);
}

async function reportCsv(userId: string, key: string): Promise<string | null> {
  const parts = parsePeriodKey(key);
  if (!parts) return null;
  const rows = await reportRows(userId, parts.year, parts.month);
  return toCsv(
    REPORT_COLUMNS,
    rows.map((row) => [
      row.datum,
      row.typ,
      row.yrke,
      row.arbetsgivare,
      row.omfattning,
      row.ort,
      row.anteckning,
      row.svarade,
    ]),
  );
}

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Inte inloggad.' }, { status: 401 });

  const url = new URL(request.url);
  const kind = url.searchParams.get('typ') ?? 'ansokningar';

  if (kind === 'kalender') {
    return new NextResponse(await calendarIcs(user.id), {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'content-disposition': contentDisposition('jobbdjungeln.ics'),
        'cache-control': 'private, no-store',
      },
    });
  }

  if (kind === 'rapport') {
    const key = url.searchParams.get('manad') ?? '';
    const csv = await reportCsv(user.id, key);
    if (csv === null) return NextResponse.json({ error: 'Ogiltig månad.' }, { status: 400 });
    const parts = parsePeriodKey(key);
    const label = parts ? periodLabel(parts.year, parts.month).toLowerCase() : key;
    return new NextResponse(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': contentDisposition(`aktivitetsrapport-${label}.csv`),
        'cache-control': 'private, no-store',
      },
    });
  }

  return new NextResponse(await applicationsCsv(user.id), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': contentDisposition(`jobbdjungeln-ansokningar-${todayIso()}.csv`),
      'cache-control': 'private, no-store',
    },
  });
}
