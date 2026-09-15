import { normalizeSkillList } from './skills.ts';

export interface ResumeSkillProfile {
  skills: readonly string[];
  confirmed: readonly string[];
}

/**
 * The skill list used for matching.
 *
 * A named job profile is a lens: confirmed terms first, then the profile's
 * skill list, then the flat CV list. An empty profile does not hide the CV.
 */
export function matchingTermsFromResume(resume: {
  skills?: readonly string[] | null;
  jobProfiles?: readonly ResumeSkillProfile[] | null;
}): string[] {
  const profiles = resume.jobProfiles ?? [];
  const active =
    profiles.find((profile) => profile.confirmed.length > 0 || profile.skills.length > 0) ??
    profiles[0];
  if (active) {
    const lens = active.confirmed.length > 0 ? active.confirmed : active.skills;
    if (lens.length > 0) return normalizeSkillList([...lens]);
  }
  return normalizeSkillList([...(resume.skills ?? [])]);
}
