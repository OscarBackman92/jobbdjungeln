/**
 * Free-text spelling help for JobTech's search.
 *
 * JobTech's `q` matching is sensitive to å/ä/ö, so someone typing "jonkoping"
 * finds nothing. A word is only rewritten when its å/ä/ö-stripped form matches a
 * real Swedish place name; anything else is passed through exactly as typed, so
 * this can never corrupt a skill or company search.
 */

import { SWEDISH_PLACES } from './places.ts';

const FOLD: Readonly<Record<string, string>> = {
  ä: 'a',
  å: 'a',
  ö: 'o',
  é: 'e',
  ü: 'u',
};

/** Strip Swedish diacritics: "Jönköping" and "jonkoping" fold to the same key. */
function foldKey(word: string): string {
  return [...word.toLowerCase()].map((char) => FOLD[char] ?? char).join('');
}

const PLACES_BY_KEY = new Map<string, string>();
for (const place of SWEDISH_PLACES) {
  // First spelling wins, so an earlier municipality is never shadowed.
  const key = foldKey(place);
  if (!PLACES_BY_KEY.has(key)) PLACES_BY_KEY.set(key, place);
}

/** Longest place name in words — how far ahead the matcher has to look. */
const MAX_PLACE_WORDS = Math.max(...SWEDISH_PLACES.map((place) => place.split(/\s+/).length));

/** Keep the user's capitalisation style: a lowercase query stays lowercase. */
function matchCase(replacement: string, original: string): string {
  return original === original.toLowerCase() ? replacement.toLowerCase() : replacement;
}

/**
 * Rewrite recognised place names to their correct Swedish spelling, leaving
 * every other word untouched. Multi-word names ("Upplands Väsby") are matched
 * greedily, longest first.
 */
export function expandSwedishQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return '';

  const words = trimmed.split(/\s+/);
  const out: string[] = [];

  for (let index = 0; index < words.length; ) {
    let matched = false;

    for (let span = Math.min(MAX_PLACE_WORDS, words.length - index); span >= 1; span -= 1) {
      const phrase = words.slice(index, index + span).join(' ');
      const place = PLACES_BY_KEY.get(foldKey(phrase));
      if (!place) continue;
      out.push(matchCase(place, phrase));
      index += span;
      matched = true;
      break;
    }

    if (!matched) {
      const word = words[index];
      if (word !== undefined) out.push(word);
      index += 1;
    }
  }

  return out.join(' ');
}

/** True when a word names a Swedish municipality or county. */
export function isSwedishPlace(word: string): boolean {
  return PLACES_BY_KEY.has(foldKey(word.trim()));
}
