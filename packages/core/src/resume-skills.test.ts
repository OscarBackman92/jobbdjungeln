import { describe, expect, it } from 'vitest';
import { matchingTermsFromResume } from './resume-skills.ts';

describe('matchingTermsFromResume', () => {
  it('uses confirmed profile terms when they exist', () => {
    expect(
      matchingTermsFromResume({
        skills: ['Excel', 'Python'],
        jobProfiles: [{ skills: ['SQL'], confirmed: ['Excel'] }],
      }),
    ).toEqual(['Excel']);
  });

  it('falls back to the profile skill list, then the flat CV', () => {
    expect(
      matchingTermsFromResume({
        skills: ['Excel'],
        jobProfiles: [{ skills: ['SQL', 'Python'], confirmed: [] }],
      }),
    ).toEqual(['SQL', 'Python']);
    expect(matchingTermsFromResume({ skills: ['Excel'], jobProfiles: [] })).toEqual(['Excel']);
  });
});
