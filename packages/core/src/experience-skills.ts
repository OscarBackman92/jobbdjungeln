import { skillHitsText } from './matching.ts';
import { canonicalSkillLabel, KNOWN_SKILL_LABELS, normalizeSkillList } from './skills.ts';

/**
 * Extra domain terms the CV matcher knows as labels but that are worth
 * suggesting from experience text even when they are not yet on the CV.
 */
const EXTRA_TERMS = [
  'kontering',
  'bokslut',
  'fakturering',
  'avstämning',
  'ekonomi',
  'administration',
  'moms',
  'budget',
  'uppföljning',
  'försäljning',
  'lager',
  'logistik',
  'HR',
  'rekrytering',
  'ITIL',
  'kvalitetssäkring',
  'arbetsmiljö',
  'inventering',
  'processutveckling',
] as const;

const GENERIC_SKIP = new Set([
  'ansvar',
  'drift',
  'kontor',
  'support',
  'operations',
  'proaktiv',
  'effektiv',
]);

const CANDIDATES: readonly string[] = normalizeSkillList([
  ...KNOWN_SKILL_LABELS,
  ...EXTRA_TERMS,
]).sort((a, b) => b.length - a.length);

export interface ExperienceRow {
  role?: string;
  employer?: string;
  title?: string;
  company?: string;
  description?: string;
}

export interface SkillSuggestion {
  label: string;
  source: string;
}

function experienceText(row: ExperienceRow): string {
  return [row.role ?? row.title, row.employer ?? row.company, row.description]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join('\n');
}

function sourceLabel(index: number, row: ExperienceRow): string {
  const title = (row.role ?? row.title ?? '').trim();
  return title ? `Erfarenhet ${index + 1}: ${title}` : `Erfarenhet ${index + 1}`;
}

/**
 * Rule-based skill suggestions from experience rows. Existing labels are
 * skipped so the UI only offers what is not already on the CV.
 */
export function suggestSkillsFromExperience(
  experience: readonly ExperienceRow[],
  existing: readonly string[] = [],
): SkillSuggestion[] {
  const seen = new Set(normalizeSkillList([...existing]).map((label) => label.toLowerCase()));
  const out: SkillSuggestion[] = [];

  for (const [index, row] of experience.entries()) {
    const text = experienceText(row);
    if (text.length < 15) continue;
    const source = sourceLabel(index, row);
    for (const label of CANDIDATES) {
      const key = canonicalSkillLabel(label).toLowerCase();
      if (seen.has(key) || GENERIC_SKIP.has(key)) continue;
      if (!skillHitsText(label, text)) continue;
      seen.add(key);
      out.push({ label: canonicalSkillLabel(label), source });
    }
  }

  return out;
}
