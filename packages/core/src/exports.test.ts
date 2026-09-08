import { describe, expect, it } from 'vitest';
import { adUrlsEquivalent, isSafeExternalUrl, normalizeAdUrl } from './ad-url.ts';
import { contentDisposition, sanitizeCsvCell, toCsv } from './csv.ts';
import { toIcs } from './ics.ts';

describe('CSV safety', () => {
  it('defuses cells a spreadsheet would execute as a formula', () => {
    expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
    expect(sanitizeCsvCell('+HYPERLINK("http://evil.test")')).toBe(
      '\'+HYPERLINK("http://evil.test")',
    );
    expect(sanitizeCsvCell('-2')).toBe("'-2");
    expect(sanitizeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(sanitizeCsvCell('\tinjected')).toBe("'\tinjected");
  });

  it('leaves ordinary values alone', () => {
    expect(sanitizeCsvCell('Acme AB')).toBe('Acme AB');
    expect(sanitizeCsvCell('2026-03-04')).toBe('2026-03-04');
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(0)).toBe('0');
  });

  it('writes a BOM and semicolon-delimited rows for Excel', () => {
    const csv = toCsv(['A', 'B'], [['1', '2']]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('A;B\r\n');
    expect(csv).toContain('1;2\r\n');
  });

  it('quotes cells containing the delimiter, quotes or newlines', () => {
    const csv = toCsv(['A'], [['sa "hej"; sedan\nnästa']]);
    expect(csv).toContain('"sa ""hej""; sedan\nnästa"');
  });

  it('builds a Content-Disposition that survives Swedish filenames', () => {
    const header = contentDisposition('ansökningar-2026.csv');
    expect(header).toContain('filename="ans_kningar-2026.csv"');
    expect(header).toContain("filename*=UTF-8''ans%C3%B6kningar-2026.csv");
  });
});

describe('ICS export', () => {
  const ics = toIcs(
    [
      {
        uid: 'app-1@jobbdjungeln',
        date: '2026-06-20',
        summary: 'Sök senast: Ekonomiassistent, Acme AB',
        description: 'Kommentar; med, tecken\nsom måste escapas',
        url: 'https://example.test/ad',
      },
    ],
    new Date('2026-06-01T08:00:00Z'),
  );

  it('produces a well-formed calendar', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('DTSTAMP:20260601T080000Z');
  });

  it('writes all-day events with an exclusive end date', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20260620');
    expect(ics).toContain('DTEND;VALUE=DATE:20260621');
  });

  it('escapes semicolons, commas and newlines in text fields', () => {
    expect(ics).toContain(';');
    expect(ics).toContain('\\,');
    expect(ics).toContain('\\n');
  });

  it('folds long lines at 75 octets with a leading space', () => {
    const long = toIcs([
      {
        uid: 'x@jobbdjungeln',
        date: '2026-06-20',
        summary: 'Å'.repeat(120),
      },
    ]);
    for (const line of long.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(long).toMatch(/\r\n /);
  });

  it('handles an empty event list', () => {
    expect(toIcs([])).toContain('END:VCALENDAR');
  });
});

describe('ad URL normalisation', () => {
  it('strips tracking parameters and trailing slashes', () => {
    expect(normalizeAdUrl('https://example.test/jobb/1/?utm_source=li&utm_campaign=x')).toBe(
      'https://example.test/jobb/1',
    );
    expect(normalizeAdUrl('https://example.test/jobb/1?fbclid=abc')).toBe(
      'https://example.test/jobb/1',
    );
  });

  it('keeps meaningful query parameters, sorted', () => {
    expect(normalizeAdUrl('https://example.test/s?b=2&a=1&utm_medium=cpc')).toBe(
      'https://example.test/s?a=1&b=2',
    );
  });

  it('folds scheme, host case, default port and fragment', () => {
    expect(normalizeAdUrl('http://Example.TEST:80/jobb/1#ansokan')).toBe(
      'https://example.test/jobb/1',
    );
  });

  it('recognises two links to the same ad', () => {
    expect(
      adUrlsEquivalent(
        'https://arbetsformedlingen.se/jobb/1?utm_source=nyhetsbrev',
        'http://Arbetsformedlingen.se/jobb/1/',
      ),
    ).toBe(true);
    expect(adUrlsEquivalent('https://a.test/1', 'https://a.test/2')).toBe(false);
    expect(adUrlsEquivalent('', '')).toBe(false);
  });

  it('leaves non-http input untouched rather than mangling it', () => {
    expect(normalizeAdUrl('inte en url')).toBe('inte en url');
    expect(normalizeAdUrl('mailto:jobb@example.test')).toBe('mailto:jobb@example.test');
    expect(normalizeAdUrl(null)).toBe('');
  });

  it('refuses to treat script URLs as linkable', () => {
    expect(isSafeExternalUrl('https://example.test')).toBe(true);
    expect(isSafeExternalUrl('http://example.test')).toBe(true);
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('data:text/html,<script>')).toBe(false);
    expect(isSafeExternalUrl(null)).toBe(false);
  });
});
