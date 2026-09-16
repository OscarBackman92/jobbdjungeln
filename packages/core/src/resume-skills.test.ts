import { describe, expect, it } from 'vitest';
import { matchingTermsFromResume, unifyResumeSkills } from './resume-skills.ts';

describe('matchingTermsFromResume', () => {
  it('uses confirmed terms that are selected in the profile', () => {
    expect(
      matchingTermsFromResume({
        skills: ['Excel', 'Python', 'SQL'],
        jobProfiles: [{ skills: ['Excel', 'SQL'], confirmed: ['Excel'] }],
      }),
    ).toEqual(['Excel']);
  });

  it('treats an empty confirmed list as all selected skills', () => {
    expect(
      matchingTermsFromResume({
        skills: ['Excel'],
        jobProfiles: [{ skills: ['SQL', 'Python'], confirmed: [] }],
      }),
    ).toEqual(['SQL', 'Python']);
    expect(matchingTermsFromResume({ skills: ['Excel'], jobProfiles: [] })).toEqual(['Excel']);
  });
});

describe('unifyResumeSkills', () => {
  it('merges profile terms into the flat list and defaults confirmed', () => {
    const result = unifyResumeSkills({
      skills: ['Excel'],
      jobProfiles: [
        { id: '1', label: 'IT', skills: ['Teams', 'Outlook'], confirmed: [] },
      ],
    });
    expect(result.skills).toEqual(['Excel', 'Teams', 'Outlook']);
    expect(result.jobProfiles[0]?.skills).toEqual(['Teams', 'Outlook']);
    expect(result.jobProfiles[0]?.confirmed).toEqual(['Teams', 'Outlook']);
  });
});
