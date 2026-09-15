/**
 * Canonical skill labels and their aliases.
 *
 * Keeps stored CV skill lists tidy ("Microsoft Excel" → "Excel") and gives the
 * matcher every surface form to look for in an ad.
 */

type CanonicalGroup = readonly [canonical: string, aliases: readonly string[]];

const CANONICAL_GROUPS: readonly CanonicalGroup[] = [
  ['Excel', ['excel', 'microsoft excel', 'ms excel']],
  ['Microsoft 365', ['microsoft 365', 'm365', 'office 365', 'microsoft office', 'ms office']],
  ['Power BI', ['power bi', 'powerbi']],
  ['SharePoint', ['sharepoint', 'microsoft sharepoint']],
  ['Word', ['word', 'microsoft word', 'ms word']],
  ['Outlook', ['outlook', 'microsoft outlook']],
  ['Teams', ['teams', 'microsoft teams']],
  ['SQL', ['sql', 'tsql', 't-sql']],
  ['PostgreSQL', ['postgresql', 'postgres']],
  ['JavaScript', ['javascript', 'js']],
  ['TypeScript', ['typescript', 'ts']],
  ['C#', ['c#', 'csharp', 'c sharp']],
  ['.NET', ['.net', 'dotnet', 'asp.net', 'aspnet']],
  ['Node.js', ['node.js', 'nodejs', 'node']],
  ['GitHub', ['github']],
  ['GitLab', ['gitlab']],
  ['Git', ['git', 'versionshantering']],
  ['Python', ['python']],
  ['Django', ['django']],
  ['React', ['react', 'react.js', 'reactjs']],
  ['Docker', ['docker']],
  ['Kubernetes', ['kubernetes', 'k8s']],
  ['AWS', ['aws', 'amazon web services']],
  ['Azure', ['azure', 'microsoft azure']],
  ['SAP', ['sap']],
  ['Fortnox', ['fortnox']],
  ['Visma', ['visma', 'visma business', 'visma.net']],
  ['Wint', ['wint']],
  ['SuperOffice', ['superoffice', 'super office']],
  ['Nettailer', ['nettailer']],
  ['CRM', ['crm']],
  ['ERP', ['erp']],
  ['Attest', ['attest', 'attestering', 'attestflöden', 'attestflode']],
  ['Agile', ['agile', 'agilt', 'agilt arbetssätt']],
  ['Scrum', ['scrum']],
  ['Kanban', ['kanban']],
  ['Projektledning', ['projektledning', 'projektledare']],
  ['Ekonomiassistent', ['ekonomiassistent', 'redovisningsassistent', 'accounts payable']],
  ['IT-support', ['it-support', 'it support', 'helpdesk', 'help desk', 'service desk']],
  ['Orderadministration', ['orderadministration', 'orderadministratör', 'orderadministrator']],
  ['Kundtjänst', ['kundtjänst', 'kundservice', 'customer support', 'customer service']],
  ['Inköp', ['inköp', 'inkop']],
  ['Upphandling', ['upphandling', 'upphandlare']],
  ['Bokföring', ['bokföring', 'bokforing', 'bokförare']],
  ['Redovisning', ['redovisning']],
  ['Lönehantering', ['lönehantering', 'löneadministration', 'lön']],
  ['B-körkort', ['b-körkort', 'b körkort', 'körkort b']],
  ['Truckkort', ['truckkort', 'truckkörkort']],
  ['Svenska', ['svenska', 'swedish']],
  ['Engelska', ['engelska', 'english']],
];

/**
 * Language labels stay in the CV vocabulary but are excluded from ad
 * requirement scoring — nearly every Swedish ad lists them, so they inflate
 * the "missing" list without saying anything useful about fit.
 */
export const LANGUAGE_SKILL_LABELS: ReadonlySet<string> = new Set(['svenska', 'engelska']);

/**
 * Canonical label (casefolded) → alternation of stems that should also match, so
 * Swedish inflections ("upphandlingar", "bokförare") hit the same requirement.
 */
export const PREFIX_STEMS: Readonly<Record<string, readonly string[]>> = {
  upphandling: ['upphandl'],
  bokföring: ['bokför', 'bokfor'],
  projektledning: ['projektled'],
  attest: ['attest'],
  redovisning: ['redovis'],
  inköp: ['inköp', 'inkop'],
  lönehantering: ['löneadministrat', 'lönehanter'],
};

const ALIAS_TO_CANONICAL = new Map<string, string>();
const CANONICAL_TO_FORMS = new Map<string, readonly string[]>();

for (const [canonical, aliases] of CANONICAL_GROUPS) {
  const forms: string[] = [];
  const seen = new Set<string>();
  for (const form of [canonical, ...aliases]) {
    const text = form.trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    forms.push(text);
    ALIAS_TO_CANONICAL.set(key, canonical);
  }
  CANONICAL_TO_FORMS.set(canonical.toLowerCase(), forms);
}

/** Every canonical label the extractor knows about. */
export const KNOWN_SKILL_LABELS: readonly string[] = CANONICAL_GROUPS.map(
  ([canonical]) => canonical,
);

/** Map a synonym onto the single stored label. Unknown labels pass through trimmed. */
export function canonicalSkillLabel(label: string): string {
  const text = label.trim();
  if (!text) return '';
  return ALIAS_TO_CANONICAL.get(text.toLowerCase()) ?? text;
}

export function isLanguageSkill(label: string): boolean {
  return LANGUAGE_SKILL_LABELS.has(canonicalSkillLabel(label).toLowerCase());
}

/** All surface forms to search for when matching a skill against ad text. */
export function skillMatchTerms(label: string): readonly string[] {
  const canonical = canonicalSkillLabel(label);
  if (!canonical) return [];
  return CANONICAL_TO_FORMS.get(canonical.toLowerCase()) ?? [canonical];
}

/** Stems that should match with a relaxed trailing boundary. */
export function skillPrefixStems(label: string): readonly string[] {
  const canonical = canonicalSkillLabel(label);
  return PREFIX_STEMS[canonical.toLowerCase()] ?? [];
}

/** Canonicalise, de-duplicate and drop blanks from a user-entered skill list. */
export function normalizeSkillList(skills: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of skills) {
    const label = canonicalSkillLabel(String(raw ?? ''));
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

const ROLE_LIKE_CANONICALS = new Set(
  [
    'Ekonomiassistent',
    'IT-support',
    'Orderadministration',
    'Kundtjänst',
    'Projektledning',
  ].map((label) => label.toLowerCase()),
);

const ROLE_SUFFIX =
  /(assistent|utvecklare|ingenjör|ingenjor|chef|handläggare|handlaggare|specialist|koordinator|tekniker|administratör|administrator|manager|konsult)$/i;

/** Labels that look like a job title rather than a skill or tool. */
export function looksLikeRoleSkill(label: string): boolean {
  const text = canonicalSkillLabel(label);
  if (!text) return false;
  if (ROLE_LIKE_CANONICALS.has(text.toLowerCase())) return true;
  return ROLE_SUFFIX.test(text.replace(/\s+/g, ''));
}

/**
 * UI display form: capitalise the first letter, keep known acronyms as-is.
 * Matching still uses {@link canonicalSkillLabel}.
 */
export function displaySkillLabel(label: string): string {
  const text = canonicalSkillLabel(label) || String(label ?? '').trim();
  if (!text) return '';
  if (/^[A-Z0-9][A-Z0-9.+#/-]{0,8}$/.test(text)) return text;
  if (text !== text.toLowerCase()) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
