/**
 * AF reporting periods.
 *
 * A period is a calendar month. Its *status* is always derived from the date and
 * whether it has been submitted — never stored — so a period can never drift out
 * of sync with the calendar.
 *
 * Arbetsförmedlingen's reporting window for a month runs from the 1st to the
 * 14th of the following month. This app is a personal aid; it does not talk to
 * any authority.
 */

import {
  daysBetween,
  formatIso,
  type IsoDate,
  monthBounds,
  monthHeading,
  monthName,
  parseIsoDate,
  today as todayIso,
} from './dates.ts';
import { plural } from './plural.ts';

export const PERIOD_STATUSES = ['pagaende', 'klar', 'rapporterad', 'forsenad'] as const;
export type PeriodStatus = (typeof PERIOD_STATUSES)[number];

export const PERIOD_STATUS_LABELS: Readonly<Record<PeriodStatus, string>> = {
  pagaende: 'Pågående',
  klar: 'Klar att rapportera',
  rapporterad: 'Rapporterad',
  forsenad: 'Försenad',
};

/** The reporting window closes on the 14th of the following month. */
export const WINDOW_CLOSES_ON_DAY = 14;

export interface PeriodKeyParts {
  year: number;
  month: number;
}

export function periodKey(year: number, month: number): string {
  return `${year}-${`${month}`.padStart(2, '0')}`;
}

export function parsePeriodKey(key: string): PeriodKeyParts | null {
  const match = /^(\d{4})-(\d{2})$/.exec(String(key ?? ''));
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

export function shiftPeriod(year: number, month: number, delta: number): PeriodKeyParts {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

/** First and last day on which the month may be reported. */
export function reportingWindow(
  year: number,
  month: number,
): { opens: IsoDate; closes: IsoDate } {
  const next = shiftPeriod(year, month, 1);
  return {
    opens: formatIso(next.year, next.month, 1),
    closes: formatIso(next.year, next.month, WINDOW_CLOSES_ON_DAY),
  };
}

export function periodStatus(
  period: { year: number; month: number; submittedAt: Date | string | null },
  today: IsoDate = todayIso(),
): PeriodStatus {
  if (period.submittedAt) return 'rapporterad';
  const { opens, closes } = reportingWindow(period.year, period.month);
  if (daysBetween(today, opens) > 0) return 'pagaende';
  if (daysBetween(today, closes) >= 0) return 'klar';
  return 'forsenad';
}

export function periodLabel(year: number, month: number): string {
  return `${monthHeading(month)} ${year}`;
}

export function periodBounds(year: number, month: number): { start: IsoDate; end: IsoDate } {
  return monthBounds(year, month);
}

/** The nudge shown at the top of the report view, or null when nothing is due. */
export function periodBanner(summary: {
  year: number;
  month: number;
  status: PeriodStatus;
  jobCount: number;
  activityCount: number;
}): string | null {
  if (summary.status !== 'klar' && summary.status !== 'forsenad') return null;
  const heading = monthHeading(summary.month);
  const { closes } = reportingWindow(summary.year, summary.month);
  const deadline = `${WINDOW_CLOSES_ON_DAY} ${monthName(parseIsoDate(closes).month)}`;
  const counts = `${plural(summary.jobCount, 'sökt jobb', 'sökta jobb')} och ${plural(
    summary.activityCount,
    'aktivitet',
    'aktiviteter',
  )}`;
  return summary.status === 'klar'
    ? `${heading} är klar att rapportera — ${counts}. Lämna in senast ${deadline}.`
    : `${heading} är försenad att rapportera — ${counts}. Fönstret stängde ${deadline}.`;
}

export const ACTIVITY_TYPES = [
  'rekryteringstraff',
  'kurs',
  'spontanansokan',
  'natverkande',
  'cv_arbete',
  'mote_af',
  'ovrigt',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Readonly<Record<ActivityType, string>> = {
  rekryteringstraff: 'Rekryteringsträff / mässa',
  kurs: 'Kurs / utbildning',
  spontanansokan: 'Spontanansökan',
  natverkande: 'Nätverkskontakt',
  cv_arbete: 'CV / personligt brev',
  mote_af: 'Möte med AF eller leverantör',
  ovrigt: 'Övrigt',
};

/**
 * Columns for the CSV download — matches the on-screen table so rows stay
 * distinguishable. Clipboard paste still uses {@link clipboardLine} (AF order).
 */
export const REPORT_COLUMNS = [
  'Datum',
  'Typ',
  'Yrkesroll',
  'Arbetsgivare',
  'Omfattning',
  'Ort',
  'Vad',
  'Svarade på annons',
] as const;

/** AF paste order — keep stable for Mina sidor. */
export const REPORT_CLIPBOARD_COLUMNS = [
  'Yrkesroll',
  'Arbetsgivare',
  'Omfattning',
  'Ort',
  'Svarade på annons',
  'Datum',
] as const;

/** Prefer the period whose reporting window is open (or overdue), else current. */
export function defaultPeriodKey(
  periods: readonly { key: string; status: PeriodStatus }[],
  fallback: string,
): string {
  const due =
    periods.find((period) => period.status === 'klar') ??
    periods.find((period) => period.status === 'forsenad');
  return due?.key ?? periods.find((period) => period.status === 'pagaende')?.key ?? fallback;
}

export interface ReportRow {
  kind: 'job' | 'event' | 'activity';
  id: string;
  datum: IsoDate | '';
  typ: string;
  yrke: string;
  arbetsgivare: string;
  omfattning: string;
  ort: string;
  svarade: '' | 'Ja' | 'Nej';
  lank: string;
  anteckning: string;
  missingOccupation: boolean;
  /** Set when appliedAt is later than an interview/contact for the same job. */
  dateWarning: string | null;
  /** Application id for job rows (and events that belong to one). */
  applicationId: string | null;
}

/** AF asks "Svarade du på en annons?" — only true for real ad responses. */
export function answeredAdLabel(source: string | null): 'Ja' | 'Nej' {
  return source === 'platsbanken' ? 'Ja' : 'Nej';
}

/** One tab-separated line, in the AF form's field order, ready to paste. */
export function clipboardLine(row: ReportRow): string {
  return [row.yrke, row.arbetsgivare, row.omfattning, row.ort, row.svarade, row.datum]
    .map((value) => String(value ?? ''))
    .join('\t');
}

export function clipboardText(rows: readonly ReportRow[]): string {
  return rows.map(clipboardLine).join('\n');
}
