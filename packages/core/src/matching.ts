/**
 * Boundary-aware skill matching.
 *
 * A skill matches only when it is not glued to an adjacent letter or digit, so
 * short skills do not false-match inside larger words: "Go" must not hit
 * "Django", "AI" must not hit "Thailand", "R" must not hit "React".
 *
 * The boundary is asserted with look-arounds over a *Unicode* word class rather
 * than `\b`, for two reasons:
 *   - JavaScript's `\b`/`\w` are ASCII-only, which would treat "ö" as a
 *     boundary and let "bokför" match inside "bokföring" by accident;
 *   - `\b` breaks entirely on symbol-edged skills such as "C++" and "C#",
 *     whose last character is not a word character.
 */

import { canonicalSkillLabel, skillMatchTerms, skillPrefixStems } from './skills.ts';

const WORD_CLASS = '[\\p{L}\\p{N}_]';

const patternCache = new Map<string, RegExp>();
const PATTERN_CACHE_LIMIT = 1024;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Compile a case-insensitive, boundary-aware matcher for one term. */
function termPattern(term: string, { prefix = false }: { prefix?: boolean } = {}): RegExp {
  const cacheKey = `${prefix ? 'p:' : 'e:'}${term}`;
  const cached = patternCache.get(cacheKey);
  if (cached) return cached;

  // Multi-word skills match as a phrase with flexible whitespace
  // ("Power BI", "React Native", "Microsoft 365").
  const body = term.trim().split(/\s+/).map(escapeRegExp).join('\\s+');
  const source = prefix
    ? `(?<!${WORD_CLASS})${body}${WORD_CLASS}*`
    : `(?<!${WORD_CLASS})${body}(?!${WORD_CLASS})`;
  const pattern = new RegExp(source, 'iu');

  if (patternCache.size >= PATTERN_CACHE_LIMIT) patternCache.clear();
  patternCache.set(cacheKey, pattern);
  return pattern;
}

/** True when any surface form (or Swedish stem) of `skill` occurs in `text`. */
export function skillHitsText(skill: string, text: string): boolean {
  if (!skill.trim() || !text) return false;
  for (const term of skillMatchTerms(skill)) {
    if (termPattern(term).test(text)) return true;
  }
  for (const stem of skillPrefixStems(skill)) {
    if (termPattern(stem, { prefix: true }).test(text)) return true;
  }
  return false;
}

/** The subset of `labels` that occurs in `text`, de-duplicated, order preserved. */
export function labelsInText(text: string, labels: readonly string[]): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const label of labels) {
    if (!skillHitsText(label, text)) continue;
    const key = canonicalSkillLabel(label).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(label);
  }
  return found;
}

/** Which CV skills appear in an ad at all — informational, not a score. */
export function cvCoverage(
  skills: readonly string[],
  text: string,
): { matched: string[]; missing: string[] } {
  const normalized = skills.filter((skill) => skill.trim());
  const matched = normalized.filter((skill) => skillHitsText(skill, text));
  const matchedSet = new Set(matched);
  return { matched, missing: normalized.filter((skill) => !matchedSet.has(skill)) };
}
