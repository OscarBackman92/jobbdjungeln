import { describe, expect, it } from 'vitest';
import { suggestSkillsFromExperience } from './experience-skills.ts';

describe('suggestSkillsFromExperience', () => {
  it('picks tools mentioned in a description and skips ones already on the CV', () => {
    const suggestions = suggestSkillsFromExperience(
      [
        {
          role: 'Ekonomiassistent',
          employer: 'Acme AB',
          description: 'Daglig kontering i Excel och Fortnox, plus avstämning mot Visma.',
        },
      ],
      ['Excel'],
    );
    const labels = suggestions.map((item) => item.label);
    expect(labels).toContain('Fortnox');
    expect(labels).toContain('Visma');
    expect(labels).not.toContain('Excel');
    expect(suggestions[0]?.source).toContain('Ekonomiassistent');
  });

  it('ignores rows that are too thin to judge', () => {
    expect(suggestSkillsFromExperience([{ role: 'Chef', description: 'Jobb' }])).toEqual([]);
  });
});
