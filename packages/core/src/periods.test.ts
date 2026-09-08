import { describe, expect, it } from 'vitest';
import {
  answeredAdLabel,
  clipboardLine,
  parsePeriodKey,
  periodBanner,
  periodBounds,
  periodKey,
  periodLabel,
  periodStatus,
  reportingWindow,
  shiftPeriod,
} from './periods.ts';

describe('period keys', () => {
  it('round-trips', () => {
    expect(periodKey(2026, 3)).toBe('2026-03');
    expect(parsePeriodKey('2026-03')).toEqual({ year: 2026, month: 3 });
  });

  it('rejects malformed and out-of-range keys', () => {
    expect(parsePeriodKey('2026-13')).toBeNull();
    expect(parsePeriodKey('2026-00')).toBeNull();
    expect(parsePeriodKey('1999-01')).toBeNull();
    expect(parsePeriodKey('2026-3')).toBeNull();
    expect(parsePeriodKey('skräp')).toBeNull();
    expect(parsePeriodKey('')).toBeNull();
  });

  it('shifts across year boundaries in both directions', () => {
    expect(shiftPeriod(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftPeriod(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftPeriod(2026, 6, 0)).toEqual({ year: 2026, month: 6 });
  });

  it('labels a period in Swedish', () => {
    expect(periodLabel(2026, 3)).toBe('Mars 2026');
  });

  it('bounds a period inclusively', () => {
    expect(periodBounds(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
});

describe('reporting window', () => {
  it('runs from the 1st to the 14th of the following month', () => {
    expect(reportingWindow(2026, 3)).toEqual({ opens: '2026-04-01', closes: '2026-04-14' });
    expect(reportingWindow(2026, 12)).toEqual({ opens: '2027-01-01', closes: '2027-01-14' });
  });
});

describe('period status', () => {
  const period = { year: 2026, month: 3, submittedAt: null };

  it('is derived from the calendar, never stored', () => {
    expect(periodStatus(period, '2026-03-20')).toBe('pagaende');
    expect(periodStatus(period, '2026-04-01')).toBe('klar');
    expect(periodStatus(period, '2026-04-14')).toBe('klar');
    expect(periodStatus(period, '2026-04-15')).toBe('forsenad');
  });

  it('reports a submitted period as reported whatever the date', () => {
    const submitted = { ...period, submittedAt: new Date('2026-04-02T10:00:00Z') };
    expect(periodStatus(submitted, '2026-03-20')).toBe('rapporterad');
    expect(periodStatus(submitted, '2026-12-31')).toBe('rapporterad');
  });
});

describe('period banner', () => {
  it('nudges only while something is actually due', () => {
    expect(
      periodBanner({ year: 2026, month: 3, status: 'pagaende', jobCount: 2, activityCount: 1 }),
    ).toBeNull();
    expect(
      periodBanner({
        year: 2026,
        month: 3,
        status: 'rapporterad',
        jobCount: 2,
        activityCount: 1,
      }),
    ).toBeNull();
  });

  it('names the month, the counts and the deadline', () => {
    const ready = periodBanner({
      year: 2026,
      month: 3,
      status: 'klar',
      jobCount: 5,
      activityCount: 2,
    });
    expect(ready).toContain('Mars');
    expect(ready).toContain('5 sökta jobb');
    expect(ready).toContain('2 aktiviteter');
    expect(ready).toContain('14 april');

    const late = periodBanner({
      year: 2026,
      month: 3,
      status: 'forsenad',
      jobCount: 5,
      activityCount: 2,
    });
    expect(late).toContain('försenad');
    expect(late).toContain('14 april');
  });
});

describe('AF form output', () => {
  it('answers "svarade på annons" only for real ad responses', () => {
    expect(answeredAdLabel('platsbanken')).toBe('Ja');
    expect(answeredAdLabel('linkedin')).toBe('Nej');
    expect(answeredAdLabel(null)).toBe('Nej');
  });

  it('emits the AF field order as one tab-separated line', () => {
    expect(
      clipboardLine({
        kind: 'job',
        id: '1',
        datum: '2026-03-04',
        typ: 'Sökt jobb',
        yrke: 'Ekonomiassistent',
        arbetsgivare: 'Acme AB',
        omfattning: 'Heltid',
        ort: 'Stockholm',
        svarade: 'Ja',
        lank: 'https://example.test/ad',
        anteckning: 'Ekonomiassistent',
        missingOccupation: false,
      }),
    ).toBe('Ekonomiassistent\tAcme AB\tHeltid\tStockholm\tJa\t2026-03-04');
  });
});
