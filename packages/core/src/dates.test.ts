import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  daysInMonth,
  formatLongDate,
  formatRelativeDays,
  formatShortDate,
  isIsoDate,
  isoDateToInstant,
  monthBounds,
  monthHeading,
  today,
  toIsoDate,
} from './dates.ts';

describe('iso date validation', () => {
  it('accepts real dates and rejects impossible ones', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true); // leap year
    expect(isIsoDate('2026-02-29')).toBe(false); // not a leap year
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-04-31')).toBe(false);
    expect(isIsoDate('2026-4-1')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it('knows month lengths including leap years', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 12)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe('date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('is unaffected by daylight saving transitions', () => {
    // Sweden moves to summer time on 2026-03-29 and back on 2026-10-25.
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
  });

  it('clamps the day when a month is too short', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('signs daysBetween by direction', () => {
    expect(daysBetween('2026-01-01', '2026-01-10')).toBe(9);
    expect(daysBetween('2026-01-10', '2026-01-01')).toBe(-9);
    expect(daysBetween('2026-01-10', '2026-01-10')).toBe(0);
  });

  it('bounds a month inclusively', () => {
    expect(monthBounds(2026, 2)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
});

describe('timezone handling', () => {
  it('reads the calendar date in Stockholm, not UTC', () => {
    // 22:30 UTC on 30 June is already 1 July in Stockholm (UTC+2 in summer).
    expect(toIsoDate(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
    // 22:30 UTC on 30 December is still 30 December (UTC+1 in winter).
    expect(toIsoDate(new Date('2026-12-30T22:30:00Z'))).toBe('2026-12-30');
  });

  it('round-trips a date through its Stockholm midnight instant', () => {
    for (const value of ['2026-01-15', '2026-06-15', '2026-03-29', '2026-10-25']) {
      expect(toIsoDate(isoDateToInstant(value))).toBe(value);
    }
  });

  it('passes through strings that are already ISO dates', () => {
    expect(toIsoDate('2026-05-04')).toBe('2026-05-04');
    expect(toIsoDate(null)).toBeNull();
    expect(toIsoDate('inte ett datum')).toBeNull();
  });

  it('produces a valid date for today', () => {
    expect(isIsoDate(today())).toBe(true);
  });
});

describe('formatting', () => {
  it('writes Swedish long and short dates', () => {
    expect(formatLongDate('2026-03-12')).toBe('12 mars 2026');
    expect(formatShortDate('2026-03-12', '2026-08-01')).toBe('12 mars');
    expect(formatShortDate('2025-03-12', '2026-08-01')).toBe('12 mars 2025');
    expect(monthHeading(3)).toBe('Mars');
  });

  it('describes relative days in Swedish', () => {
    expect(formatRelativeDays('2026-05-10', '2026-05-10')).toBe('idag');
    expect(formatRelativeDays('2026-05-11', '2026-05-10')).toBe('imorgon');
    expect(formatRelativeDays('2026-05-09', '2026-05-10')).toBe('igår');
    expect(formatRelativeDays('2026-05-13', '2026-05-10')).toBe('om 3 dagar');
    expect(formatRelativeDays('2026-05-07', '2026-05-10')).toBe('3 dagar sedan');
  });

  it('returns an empty string for missing input rather than throwing', () => {
    expect(formatLongDate(null)).toBe('');
    expect(formatShortDate(undefined)).toBe('');
    expect(formatRelativeDays('skräp')).toBe('');
  });
});
