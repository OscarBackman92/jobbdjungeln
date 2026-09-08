/**
 * Date helpers. Everything user-visible is a *calendar* date in Europe/Stockholm,
 * stored and passed around as an ISO `YYYY-MM-DD` string so no timezone can
 * silently shift a deadline across midnight.
 */

export const APP_TIME_ZONE = 'Europe/Stockholm';

/** Branded-ish alias to make intent obvious at call sites. */
export type IsoDate = string;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today in Europe/Stockholm as `YYYY-MM-DD`. */
export function today(now: Date = new Date()): IsoDate {
  return isoFormatter.format(now);
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const parts = value.split('-').map(Number) as [number, number, number];
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Parse `YYYY-MM-DD` into its parts. Throws on malformed input. */
export function parseIsoDate(value: IsoDate): { year: number; month: number; day: number } {
  if (!isIsoDate(value)) {
    throw new RangeError(`Ogiltigt datum: ${value}`);
  }
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

function toUtcMillis(value: IsoDate): number {
  const { year, month, day } = parseIsoDate(value);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMillis(millis: number): IsoDate {
  const date = new Date(millis);
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const MS_PER_DAY = 86_400_000;

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMillis(to) - toUtcMillis(from)) / MS_PER_DAY);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return fromUtcMillis(toUtcMillis(value) + days * MS_PER_DAY);
}

export function addMonths(value: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseIsoDate(value);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return formatIso(targetYear, targetMonth, clampedDay);
}

export function formatIso(year: number, month: number, day: number): IsoDate {
  return `${`${year}`.padStart(4, '0')}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`;
}

/** Calendar date of an instant, in app time. Accepts null for convenience. */
export function toIsoDate(value: Date | string | null | undefined): IsoDate | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    if (isIsoDate(value)) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : isoFormatter.format(parsed);
  }
  return Number.isNaN(value.getTime()) ? null : isoFormatter.format(value);
}

/** Midnight (app time) of an ISO date as a UTC instant — for timestamp columns. */
export function isoDateToInstant(value: IsoDate): Date {
  const { year, month, day } = parseIsoDate(value);
  // Stockholm is UTC+1 or UTC+2; resolve the real offset for that date.
  const naiveUtc = Date.UTC(year, month - 1, day);
  const offsetMinutes = timeZoneOffsetMinutes(new Date(naiveUtc));
  return new Date(naiveUtc - offsetMinutes * 60_000);
}

function timeZoneOffsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const lookup = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  const asUtc = Date.UTC(
    lookup('year'),
    lookup('month') - 1,
    lookup('day'),
    lookup('hour') % 24,
    lookup('minute'),
    lookup('second'),
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

export const MONTH_NAMES_SV = [
  'januari',
  'februari',
  'mars',
  'april',
  'maj',
  'juni',
  'juli',
  'augusti',
  'september',
  'oktober',
  'november',
  'december',
] as const;

export function monthName(month: number): string {
  return MONTH_NAMES_SV[month - 1] ?? '';
}

export function monthHeading(month: number): string {
  const name = monthName(month);
  return name ? `${name.slice(0, 1).toUpperCase()}${name.slice(1)}` : '';
}

/** "12 mars 2026" */
export function formatLongDate(value: IsoDate | null | undefined): string {
  if (!value || !isIsoDate(value)) return '';
  const { year, month, day } = parseIsoDate(value);
  return `${day} ${monthName(month)} ${year}`;
}

/** "12 mars" — the year is dropped when it is the current one. */
export function formatShortDate(
  value: IsoDate | null | undefined,
  reference: IsoDate = today(),
): string {
  if (!value || !isIsoDate(value)) return '';
  const { year, month, day } = parseIsoDate(value);
  const sameYear = parseIsoDate(reference).year === year;
  return sameYear ? `${day} ${monthName(month)}` : `${day} ${monthName(month)} ${year}`;
}

/** "idag", "igår", "om 3 dagar", "3 dagar sedan". */
export function formatRelativeDays(
  value: IsoDate | null | undefined,
  reference: IsoDate = today(),
): string {
  if (!value || !isIsoDate(value)) return '';
  const delta = daysBetween(reference, value);
  if (delta === 0) return 'idag';
  if (delta === 1) return 'imorgon';
  if (delta === -1) return 'igår';
  if (delta > 0) return `om ${delta} dagar`;
  return `${Math.abs(delta)} dagar sedan`;
}

/** Inclusive first/last calendar day of a month. */
export function monthBounds(year: number, month: number): { start: IsoDate; end: IsoDate } {
  return {
    start: formatIso(year, month, 1),
    end: formatIso(year, month, daysInMonth(year, month)),
  };
}
