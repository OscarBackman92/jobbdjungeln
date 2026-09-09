/**
 * Heuristic CV parsing.
 *
 * A CV has no schema, so this is deliberately conservative: it segments the text
 * by recognised headings, then reads each section with narrow rules. Anything it
 * cannot place confidently is left out rather than guessed at — the user edits
 * the result before it is saved, and a wrong entry costs them more than a
 * missing one.
 */

import {
  canonicalSkillLabel,
  KNOWN_SKILL_LABELS,
  labelsInText,
  normalizeSkillList,
} from '@jobbdjungeln/core';

export interface ParsedExperience {
  role: string;
  employer: string;
  start: string;
  end: string;
  description: string;
  skills: string[];
}

export interface ParsedEducation {
  program: string;
  school: string;
  start: string;
  end: string;
}

export interface ParsedResume {
  headline: string;
  summary: string;
  skills: string[];
  experience: ParsedExperience[];
  education: ParsedEducation[];
  /** Contact details found in the text — shown so the user can check them. */
  contact: { email: string; phone: string };
}

type SectionName = 'profile' | 'skills' | 'experience' | 'education' | 'ignore';

const SECTION_HEADINGS: Readonly<Record<SectionName, readonly string[]>> = {
  profile: ['profil', 'profile', 'om mig', 'about me', 'sammanfattning', 'personligt brev'],
  skills: [
    'kompetenser',
    'kompetens',
    'färdigheter',
    'skills',
    'tekniker',
    'teknisk kompetens',
    'kunskaper',
    'systemvana',
  ],
  experience: [
    'arbetslivserfarenhet',
    'yrkeserfarenhet',
    'tidigare anställningar',
    'anställningar',
    'work experience',
    'erfarenhet',
    'experience',
  ],
  education: ['utbildningar', 'utbildning', 'education', 'kurser', 'courses'],
  ignore: [
    'personliga egenskaper',
    'egenskaper',
    'referenser',
    'references',
    'språk',
    'languages',
    'körkort',
    'övrigt',
    'kontaktuppgifter',
    'kontakt',
    'contact',
    'intressen',
    'meriter',
  ],
};

/** Longest first, so "arbetslivserfarenhet" wins over "erfarenhet". */
const HEADINGS: ReadonlyArray<readonly [heading: string, section: SectionName]> =
  Object.entries(SECTION_HEADINGS)
    .flatMap(([section, names]) => names.map((name) => [name, section as SectionName] as const))
    .sort((a, b) => b[0].length - a[0].length);

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
// Swedish numbers, written with any mix of spaces and dashes.
const PHONE_RE = /(?<!\d)(?:\+46[ -]?|0)\d[\d -]{6,}\d(?!\d)/;

const MONTH =
  '(?:januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december|' +
  'january|february|march|may|june|july|august|october|jan|feb|mar|apr|jun|jul|aug|sep|okt|oct|nov|dec)';
const YEAR = '(?:19|20)\\d{2}';
const DATE = `(?:${MONTH}\\.?\\s+)?${YEAR}`;
const ONGOING = '(?:pågående|nuvarande|present|ongoing|idag|nu|-)';
const DASH = '[–—-]';

const DATE_RANGE_RE = new RegExp(`(${DATE})\\s*${DASH}\\s*(${DATE}|${ONGOING})`, 'i');
const BULLET_RE = /^\s*[•·▪*‣◦]\s*|^\s*[–-]\s+/;
const PAGE_NUMBER_RE = /^\d{1,3}$|^sida \d+/i;
const SEPARATOR_RE = /\s*[|•·,]\s*|\s*[–—]\s*|\s{3,}/;

const MAX_SKILL_LENGTH = 40;
const MAX_SKILL_WORDS = 3;
const MAX_HEADLINE_LENGTH = 90;
const MAX_SUMMARY_LENGTH = 600;

/** PDF text extractors double spaces; collapse runs but keep line breaks. */
function cleanLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim();
}

/** Share of single-character words above which a line is read as letter-spaced. */
const LETTER_SPACED_RATIO = 0.7;
const LETTER_SPACED_MIN_WORDS = 4;

/**
 * Undo the letter-spacing that design CVs use for headings.
 *
 * Such a heading reaches us as "A R B E T S L I V S E R F A R E N H E T", and a
 * date as "N O V E M B E R 2 0 1 8". The spaces between words are
 * indistinguishable from the spaces between letters, so word boundaries can only
 * be recovered where the character class changes — which is enough to read the
 * dates and headings that give the CV its structure.
 */
export function collapseLetterSpacing(line: string): string {
  const words = line.split(' ').filter(Boolean);
  if (words.length < LETTER_SPACED_MIN_WORDS) return line;

  const singles = words.filter((word) => [...word].length === 1).length;
  if (singles / words.length < LETTER_SPACED_RATIO) return line;

  return words
    .join('')
    .replace(/(\p{L})(\d)/gu, '$1 $2')
    .replace(/(\d)(\p{L})/gu, '$1 $2')
    .replace(/\s*([\u2013\u2014-])\s*/gu, ' $1 ')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Headings are compared with all spaces removed, so letter-spacing cannot hide one. */
function headingKey(line: string): string {
  return cleanLine(line)
    .replace(/[:：]\s*$/, '')
    .toLowerCase()
    .replace(/\s+/gu, '');
}

const HEADING_KEYS = new Map(
  HEADINGS.map(([heading, section]) => [heading.replace(/\s+/g, ''), section] as const),
);

const MAX_HEADING_LENGTH = 40;

/** The section a line starts, or null when the line is ordinary content. */
function headingSection(line: string): SectionName | null {
  const key = headingKey(line);
  if (!key || key.length > MAX_HEADING_LENGTH) return null;
  return HEADING_KEYS.get(key) ?? null;
}

interface Section {
  name: SectionName | 'header';
  lines: string[];
}

/** Split the raw text into sections, keeping everything before the first heading. */
export function splitSections(text: string): Section[] {
  const sections: Section[] = [{ name: 'header', lines: [] }];

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = collapseLetterSpacing(cleanLine(raw));
    if (!line || PAGE_NUMBER_RE.test(line)) continue;

    const section = headingSection(line);
    if (section) {
      sections.push({ name: section, lines: [] });
      continue;
    }
    sections.at(-1)?.lines.push(line);
  }

  return sections.filter((section) => section.lines.length > 0 || section.name !== 'header');
}

function linesOf(sections: readonly Section[], name: Section['name']): string[] {
  return sections
    .filter((section) => section.name === name)
    .flatMap((section) => section.lines);
}

/** Skills named anywhere in the text, plus anything listed in a skills section. */
export function findSkills(fullText: string, skillLines: readonly string[]): string[] {
  const found: string[] = [];

  // Explicit lists win: they are what the person chose to claim.
  for (const line of skillLines) {
    let text = line.replace(BULLET_RE, '');
    // "Programmeringsspråk: Java, Python" — drop the label, keep the list.
    const colon = text.search(/[:：]/u);
    if (colon !== -1) text = text.slice(colon + 1);

    for (const part of text.split(SEPARATOR_RE)) {
      const candidate = cleanLine(part);
      // A sentence is a description, not a skill.
      if (!candidate || candidate.length > MAX_SKILL_LENGTH) continue;

      // A two-column skills list flattens into one line ("SuperOffice CRM"), so
      // when a candidate names several known skills, take those rather than the
      // run-together string.
      const known = labelsInText(candidate, KNOWN_SKILL_LABELS);
      if (known.length > 0) {
        found.push(...known);
        continue;
      }
      if (candidate.split(' ').length <= MAX_SKILL_WORDS) found.push(candidate);
    }
  }

  // Then anything the canonical vocabulary recognises in the body text.
  const haystack = fullText.toLowerCase();
  for (const label of KNOWN_SKILL_LABELS) {
    if (haystack.includes(label.toLowerCase())) found.push(label);
  }

  return normalizeSkillList(found);
}

function parseDateRange(line: string): { start: string; end: string } | null {
  const match = DATE_RANGE_RE.exec(line);
  if (!match) {
    const year = new RegExp(`^${YEAR}$`).exec(line.trim());
    return year ? { start: year[0], end: '' } : null;
  }
  const end = (match[2] ?? '').trim();
  return {
    start: (match[1] ?? '').trim(),
    end: /^(pågående|nuvarande|present|ongoing|idag|nu|-)$/i.test(end) ? 'Pågående' : end,
  };
}

interface RawEntry {
  title: string;
  subtitle: string;
  start: string;
  end: string;
  description: string;
}

const MAX_TITLE_LENGTH = 80;

/**
 * Design CVs often shout headings and roles in ALL CAPS. Turn those into
 * readable title case without touching mixed-case text.
 */
export function normalizeCapsTitle(text: string): string {
  const trimmed = cleanLine(text);
  if (!trimmed) return '';
  const letters = [...trimmed].filter((char) => /\p{L}/u.test(char));
  if (letters.length < 4) return trimmed;
  const upper = letters.filter((char) => char === char.toUpperCase() && char !== char.toLowerCase())
    .length;
  if (upper / letters.length < 0.8) return trimmed;
  return trimmed.replace(/\p{L}+/gu, (word) => {
    const [first = '', ...rest] = [...word];
    return `${first.toLocaleUpperCase('sv')}${rest.join('').toLocaleLowerCase('sv')}`;
  });
}

/** A line that could open an entry: short, not a bullet, not a sentence. */
function looksLikeTitle(line: string): boolean {
  const text = cleanLine(line);
  if (!text || text.length > MAX_TITLE_LENGTH) return false;
  if (BULLET_RE.test(line)) return false;
  return !/[.:;]$/.test(text);
}

function splitTitle(line: string): { title: string; subtitle: string } {
  const parts = line.split(SEPARATOR_RE).map(cleanLine).filter(Boolean);
  if (parts.length <= 1) {
    return { title: normalizeCapsTitle(line), subtitle: '' };
  }
  return {
    title: normalizeCapsTitle(parts[0] ?? ''),
    subtitle: normalizeCapsTitle(parts.slice(1).join(', ')),
  };
}

/** A line ending in a year, as education lists are usually written. */
const TRAILING_YEARS_RE = new RegExp(
  `^(.*\\S)[,\\s]+(${YEAR}(?:\\s*${DASH}\\s*(?:${YEAR}|${ONGOING}))?)\\s*$`,
  'i',
);

/**
 * Read a line that carries an entry's dates, in any of the forms CVs use:
 * a date on its own, a date followed by the role, or a title ending in a year.
 */
function readDateLine(
  line: string,
): { range: { start: string; end: string }; inlineTitle: string } | null {
  const range = parseDateRange(line);
  if (range) {
    // A bare year is the whole line; only a real range can leave a title behind.
    const inlineTitle = DATE_RANGE_RE.test(line)
      ? cleanLine(
          line
            .replace(DATE_RANGE_RE, '')
            .replace(/^[\s,|\u2013\u2014-]+|[\s,|\u2013\u2014-]+$/gu, ''),
        )
      : '';
    return { range, inlineTitle };
  }

  const trailing = TRAILING_YEARS_RE.exec(cleanLine(line));
  const head = trailing?.[1];
  const tail = trailing?.[2];
  if (!head || !tail || !looksLikeTitle(head)) return null;

  const parsed = parseDateRange(tail);
  return parsed ? { range: parsed, inlineTitle: head } : null;
}

function newEntry(line: string): RawEntry {
  const { title, subtitle } = splitTitle(line);
  return { title, subtitle, start: '', end: '', description: '' };
}

function appendDescription(entry: RawEntry, line: string): void {
  const body = cleanLine(line.replace(BULLET_RE, ''));
  if (!body) return;
  entry.description = entry.description ? `${entry.description}\n${body}` : body;
}

/**
 * Read an experience or education section.
 *
 * The date range is what marks an entry, and real CVs put it in three different
 * places: on the title line, on the line above it, or — once a multi-column
 * layout has been flattened into a single stream of text — on the line below it.
 * So the section is walked in order and a date attaches to the entry being built,
 * while a title-like line only starts a new entry when the current one is
 * evidently finished. Ambiguous lines become description rather than a guess.
 */
function parseEntries(lines: readonly string[]): RawEntry[] {
  const entries: RawEntry[] = [];
  let current: RawEntry | null = null;
  /** A date read before its entry has appeared. */
  let pending: { start: string; end: string } | null = null;

  const commit = (): void => {
    if (current?.title) entries.push(current);
    current = null;
  };

  for (const [index, line] of lines.entries()) {
    const dated = readDateLine(line);

    if (dated) {
      const { range, inlineTitle } = dated;
      if (inlineTitle) {
        // "Utvecklare, Beta AB 2017 – 2020" — title and date on one line.
        commit();
        current = newEntry(inlineTitle);
        current.start = range.start;
        current.end = range.end;
        continue;
      }
      if (current && !current.start) {
        current.start = range.start;
        current.end = range.end;
      } else {
        commit();
        pending = range;
      }
      continue;
    }

    const titleish = looksLikeTitle(line);

    if (!current) {
      if (!titleish) continue;
      current = newEntry(line);
      if (pending) {
        current.start = pending.start;
        current.end = pending.end;
        pending = null;
      }
      continue;
    }

    // A new entry always sits next to a date: either one we have just read and
    // not yet placed, or one on the line below. A wrapped description line can
    // look exactly like a title, so nothing else is allowed to start an entry.
    if (titleish && pending) {
      commit();
      current = newEntry(line);
      current.start = pending.start;
      current.end = pending.end;
      pending = null;
      continue;
    }

    const nextIsDate = parseDateRange(lines[index + 1] ?? '') !== null;
    if (titleish && current.start && nextIsDate) {
      commit();
      current = newEntry(line);
      continue;
    }

    // The line right under a role is the employer, not yet a description.
    if (titleish && !current.subtitle && !current.description) {
      current.subtitle = cleanLine(line);
      continue;
    }

    appendDescription(current, line);
  }

  commit();
  return entries;
}

export function parseExperience(lines: readonly string[]): ParsedExperience[] {
  return parseEntries(lines).map((entry) => ({
    role: entry.title,
    employer: entry.subtitle,
    start: entry.start,
    end: entry.end,
    description: entry.description,
    skills: normalizeSkillList(
      KNOWN_SKILL_LABELS.filter((label) =>
        `${entry.title} ${entry.description}`.toLowerCase().includes(label.toLowerCase()),
      ),
    ),
  }));
}

export function parseEducation(lines: readonly string[]): ParsedEducation[] {
  return parseEntries(lines).map((entry) => ({
    program: entry.title,
    school: entry.subtitle || cleanLine(entry.description.split('\n')[0] ?? ''),
    start: entry.start,
    end: entry.end,
  }));
}

/** The person's own one-line description of themselves, if the CV opens with one. */
function findHeadline(headerLines: readonly string[]): string {
  for (const line of headerLines) {
    if (EMAIL_RE.test(line) || PHONE_RE.test(line)) continue;
    if (line.length > MAX_HEADLINE_LENGTH) continue;
    // The first line is usually the name; the second is the role.
    if (headerLines.indexOf(line) === 0) continue;
    if (/\d{4}/.test(line)) continue;
    return normalizeCapsTitle(line);
  }
  return normalizeCapsTitle(headerLines[0] ?? '');
}

/** Turn extracted CV text into an editable draft. Nothing here is persisted. */
export function parseResume(text: string): ParsedResume {
  const sections = splitSections(text);
  const headerLines = linesOf(sections, 'header');
  const profileLines = linesOf(sections, 'profile');

  const summary = profileLines.join(' ').slice(0, MAX_SUMMARY_LENGTH);
  const skills = findSkills(text, linesOf(sections, 'skills'));

  const experience = parseExperience(linesOf(sections, 'experience'));

  return {
    // A sidebar CV has no header block at all; the current role is the next
    // best description of the person, and the user can edit it.
    headline: findHeadline(headerLines) || (experience[0]?.role ?? ''),
    summary,
    skills,
    experience,
    education: parseEducation(linesOf(sections, 'education')),
    contact: {
      email: EMAIL_RE.exec(text)?.[0] ?? '',
      phone: PHONE_RE.exec(text)?.[0]?.trim() ?? '',
    },
  };
}

export { canonicalSkillLabel };
