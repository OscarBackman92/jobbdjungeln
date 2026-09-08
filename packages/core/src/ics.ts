/**
 * iCalendar export for deadlines and follow-ups.
 *
 * Hand-rolled rather than pulled from a library: the output is a handful of
 * all-day VEVENTs, and RFC 5545 line folding plus escaping is the whole job.
 */

import type { IsoDate } from './dates.ts';
import { addDays, parseIsoDate } from './dates.ts';

export interface CalendarEvent {
  uid: string;
  date: IsoDate;
  summary: string;
  description?: string;
  url?: string;
}

const PRODID = '-//Jobbdjungeln//Kalender//SV';
const MAX_LINE_OCTETS = 75;

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function compactDate(value: IsoDate): string {
  const { year, month, day } = parseIsoDate(value);
  return `${year}${`${month}`.padStart(2, '0')}${`${day}`.padStart(2, '0')}`;
}

/** RFC 5545 §3.1: fold at 75 octets, continuation lines start with a space. */
function fold(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) return line;

  const out: string[] = [];
  let current = '';
  let currentOctets = 0;
  let limit = MAX_LINE_OCTETS;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (currentOctets + size > limit) {
      out.push(current);
      current = char;
      currentOctets = size;
      // Continuation lines lose one octet to the leading space.
      limit = MAX_LINE_OCTETS - 1;
    } else {
      current += char;
      currentOctets += size;
    }
  }
  out.push(current);
  return out.map((part, index) => (index === 0 ? part : ` ${part}`)).join('\r\n');
}

function stamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

export function toIcs(events: readonly CalendarEvent[], now: Date = new Date()): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Jobbdjungeln',
  ];

  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stamp(now)}`);
    // All-day events: DTEND is exclusive, so it is the day after.
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.date)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(addDays(event.date, 1))}`);
    lines.push(`SUMMARY:${escapeText(event.summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    if (event.url) lines.push(`URL:${escapeText(event.url)}`);
    lines.push('TRANSP:TRANSPARENT');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
