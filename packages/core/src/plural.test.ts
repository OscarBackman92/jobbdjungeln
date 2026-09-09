import { describe, expect, it } from 'vitest';
import { periodBanner } from './periods.ts';
import { plural, pluralWord } from './plural.ts';

describe('plural', () => {
  it('agrees with the count', () => {
    expect(plural(1, 'rad', 'rader')).toBe('1 rad');
    expect(plural(2, 'rad', 'rader')).toBe('2 rader');
    expect(plural(0, 'rad', 'rader')).toBe('0 rader');
  });

  it('can give just the word', () => {
    expect(pluralWord(1, 'ansökan', 'ansökningar')).toBe('ansökan');
    expect(pluralWord(3, 'ansökan', 'ansökningar')).toBe('ansökningar');
  });
});

describe('rapportbannern räknar rätt', () => {
  it('böjer både jobb och aktiviteter', () => {
    const one = periodBanner({
      year: 2026,
      month: 3,
      status: 'klar',
      jobCount: 1,
      activityCount: 1,
    });
    expect(one).toContain('1 sökt jobb');
    expect(one).toContain('1 aktivitet.');

    const many = periodBanner({
      year: 2026,
      month: 3,
      status: 'klar',
      jobCount: 4,
      activityCount: 2,
    });
    expect(many).toContain('4 sökta jobb');
    expect(many).toContain('2 aktiviteter');
  });
});
