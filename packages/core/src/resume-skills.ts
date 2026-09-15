import { normalizeSkillList } from './skills.ts';

export interface ResumeSkillProfile {
  skills: readonly string[];
  confirmed: readonly string[];
}

/**
 * The skill list used for matching.
 *
 * A named job profile is a lens over the flat CV skill list: confirmed terms
 * in the profile (defaulting to every selected skill) drive matching. An empty
 * profile does not hide the CV.
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
    const selected = normalizeSkillList([...active.skills]);
    if (selected.length > 0) {
      const confirmed = normalizeSkillList([...active.confirmed]);
      // Empty confirmed means "all selected" (legacy rows before defaulting).
      const lens =
        confirmed.length > 0
          ? selected.filter((skill) =>
              confirmed.some((item) => item.toLowerCase() === skill.toLowerCase()),
            )
          : selected;
      if (lens.length > 0) return lens;
    }
  }
  return normalizeSkillList([...(resume.skills ?? [])]);
}

/**
 * Merge job-profile terms into the flat CV list and treat each profile as a
 * named selection. Confirmed defaults to the full selection when missing.
 */
export function unifyResumeSkills<T extends ResumeSkillProfile & { id: string; label: string }>(resume: {
  skills?: readonly string[] | null;
  jobProfiles?: readonly T[] | null;
}): { skills: string[]; jobProfiles: T[] } {
  const profiles = resume.jobProfiles ?? [];
  const skills = normalizeSkillList([
    ...(resume.skills ?? []),
    ...profiles.flatMap((profile) => [...profile.skills, ...profile.confirmed]),
  ]);
  const skillKeys = new Set(skills.map((skill) => skill.toLowerCase()));

  const jobProfiles = profiles.map((profile) => {
    const selected = normalizeSkillList([...profile.skills]).filter((skill) =>
      skillKeys.has(skill.toLowerCase()),
    );
    const confirmedRaw = normalizeSkillList([...profile.confirmed]).filter((skill) =>
      selected.some((item) => item.toLowerCase() === skill.toLowerCase()),
    );
    const confirmed = confirmedRaw.length > 0 ? confirmedRaw : [...selected];
    return { ...profile, skills: selected, confirmed };
  });

  return { skills, jobProfiles };
}
