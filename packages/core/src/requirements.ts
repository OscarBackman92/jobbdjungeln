/**
 * Requirement extraction and CV↔ad coverage scoring.
 *
 * Rule-based and explainable on purpose: an ad is split into lines, each line is
 * classified as a hard requirement ("must") or a nice-to-have ("merit") from
 * Swedish cue words, and the user's skills are scored against *the ad's*
 * requirements — never against the size of their CV. A long CV must not be able
 * to inflate a match.
 */

import { labelsInText, skillHitsText } from './matching.ts';
import { canonicalSkillLabel, KNOWN_SKILL_LABELS } from './skills.ts';

export type RequirementLevel = 'must' | 'merit';
export type MatchBand = 'strong' | 'medium' | 'weak' | 'unknown';
export type MatchConfidence = 'high' | 'low';

export interface Requirement {
  term: string;
  level: RequirementLevel;
  snippet: string;
  sourceLine: number;
}

export interface EvidenceSource {
  /** Where in the CV the claim came from, e.g. "Erfarenhet: Acme AB". */
  label?: string;
  kind?: 'experience' | 'education' | 'summary' | 'manual';
}

export interface Evidence {
  term: string;
  confirmed?: boolean;
  source?: EvidenceSource;
}

export interface CoveredRequirement extends Omit<Requirement, 'sourceLine'> {
  source: EvidenceSource;
}

export interface MatchResult {
  mustTotal: number;
  mustCovered: number;
  meritTotal: number;
  meritCovered: number;
  /** 0–100, or null when the ad is too thin to score honestly. */
  score: number | null;
  band: MatchBand;
  confidence: MatchConfidence;
  covered: CoveredRequirement[];
  gaps: Omit<Requirement, 'sourceLine'>[];
  /** CV skills the ad never mentions — informational, not a gap. */
  unusedCvTerms: string[];
  cvTermsUsed: number;
  cvTermsTotal: number;
}

export interface PostingLike {
  title?: string | null;
  description?: string | null;
}

const MUST_CUES = [
  'krav',
  'vi kräver',
  'du har',
  'du ska',
  'du måste',
  'vi söker dig som',
  'du besitter',
  'det krävs',
  'kvalifikationer',
] as const;

const MERIT_CUES = [
  'meriterande',
  'är ett plus',
  'gärna',
  'fördel om',
  'önskvärt',
  'ser vi positivt',
  'extra plus',
] as const;

/** Sections that describe the employer, not the candidate. */
const BOILERPLATE_HEADERS = [
  'om oss',
  'om företaget',
  'vi erbjuder',
  'ansökan',
  'så här söker du',
  'villkor',
] as const;

const LIST_PREFIX = /^\s*(?:[-•*–]|\d+[.)])\s+/;
const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-ZÅÄÖ])/;

const MAX_HEADER_LENGTH = 60;
const MIN_DESCRIPTION_LENGTH_FOR_CONFIDENCE = 200;
/** Additive smoothing: a 2/2 ad can never report 100 %. */
const SCORE_SHRINKAGE = 2;
const SNIPPET_LENGTH = 120;

function knownLabels(extraTerms: readonly string[] = []): string[] {
  const labels = [...KNOWN_SKILL_LABELS];
  const seen = new Set(labels.map((label) => label.toLowerCase()));
  for (const term of extraTerms) {
    const label = canonicalSkillLabel(term);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
  }
  return labels;
}

function isHeader(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length >= MAX_HEADER_LENGTH) return false;
  return !/[.!?]$/.test(trimmed);
}

function isBoilerplateHeader(line: string): boolean {
  const lowered = line.toLowerCase().replace(/^[\s:]+|[\s:]+$/g, '');
  return BOILERPLATE_HEADERS.some((header) => lowered.includes(header));
}

function lineLevel(line: string, inherited: RequirementLevel): RequirementLevel {
  const lowered = line.toLowerCase();
  if (MERIT_CUES.some((cue) => lowered.includes(cue))) return 'merit';
  if (MUST_CUES.some((cue) => lowered.includes(cue))) return 'must';
  return inherited;
}

function hasRequirementCue(line: string): boolean {
  const lowered = line.toLowerCase();
  return (
    MUST_CUES.some((cue) => lowered.includes(cue)) ||
    MERIT_CUES.some((cue) => lowered.includes(cue))
  );
}

/** Split into (1-based source line, text) pairs; single-blob ads split by sentence. */
function splitDescription(description: string): Array<{ line: number; text: string }> {
  if (!description) return [];
  const rawLines = description.replace(/\r\n?/g, '\n').split('\n');
  const rows: Array<{ line: number; text: string }> = [];
  const singleBlob = rawLines.length === 1;

  for (const [index, raw] of rawLines.entries()) {
    const line = raw.replace(LIST_PREFIX, '').trim();
    if (!line) continue;
    if (singleBlob) {
      for (const sentence of line.split(SENTENCE_SPLIT)) {
        const text = sentence.trim();
        if (text) rows.push({ line: index + 1, text });
      }
    } else {
      rows.push({ line: index + 1, text: line });
    }
  }
  return rows;
}

/** Extract must/merit requirements from an ad's title and description. */
export function extractRequirements(
  posting: PostingLike,
  { extraTerms = [] }: { extraTerms?: readonly string[] } = {},
): Requirement[] {
  const title = posting.title ?? '';
  const description = posting.description ?? '';
  const labels = knownLabels(extraTerms);
  const results = new Map<string, Requirement>();

  const addHit = (
    term: string,
    level: RequirementLevel,
    snippet: string,
    sourceLine: number,
  ): void => {
    const key = term.toLowerCase();
    const existing = results.get(key);
    // "must" always wins over "merit"; first occurrence wins within a level.
    if (existing && (existing.level === 'must' || level === 'merit')) return;
    results.set(key, { term, level, snippet: snippet.slice(0, SNIPPET_LENGTH), sourceLine });
  };

  // A skill named in the title is a hard requirement.
  for (const term of labelsInText(title, labels)) {
    addHit(term, 'must', title.trim(), 0);
  }

  let inherited: RequirementLevel = 'must';
  let skippingBoilerplate = false;

  for (const { line, text } of splitDescription(description)) {
    if (isHeader(text)) {
      if (isBoilerplateHeader(text) && !hasRequirementCue(text)) {
        skippingBoilerplate = true;
        continue;
      }
      skippingBoilerplate = false;
      inherited = lineLevel(text, inherited);
      for (const term of labelsInText(text, labels)) {
        addHit(term, inherited, text, line);
      }
      continue;
    }
    if (skippingBoilerplate) continue;

    const level = lineLevel(text, inherited);
    for (const term of labelsInText(text, labels)) {
      addHit(term, level, text, line);
    }
  }

  return [...results.values()];
}

function bandFor(score: number | null, confidence: MatchConfidence): MatchBand {
  if (confidence === 'low' || score === null) return 'unknown';
  if (score >= 70) return 'strong';
  if (score >= 40) return 'medium';
  return 'weak';
}

function isEvidenceArray(
  input: readonly string[] | readonly Evidence[],
): input is readonly Evidence[] {
  return input.length > 0 && typeof input[0] === 'object' && input[0] !== null;
}

/** Score how well a CV covers an ad's extracted requirements. */
export function scorePosting(
  cvInput: readonly string[] | readonly Evidence[],
  posting: PostingLike,
): MatchResult {
  let cvTerms: string[];
  const evidenceByTerm = new Map<string, EvidenceSource>();

  if (isEvidenceArray(cvInput)) {
    const evidence = cvInput.filter((item) => item.confirmed !== false && item.term);
    cvTerms = evidence.map((item) => item.term);
    for (const item of evidence) {
      evidenceByTerm.set(canonicalSkillLabel(item.term).toLowerCase(), item.source ?? {});
    }
  } else {
    cvTerms = cvInput.filter((term) => String(term).trim());
    for (const term of cvTerms) {
      evidenceByTerm.set(canonicalSkillLabel(term).toLowerCase(), {});
    }
  }

  const requirements = extractRequirements(posting, { extraTerms: cvTerms });
  const description = posting.description ?? '';
  const fullText = `${posting.title ?? ''}\n${description}`;

  const covered: CoveredRequirement[] = [];
  const gaps: Omit<Requirement, 'sourceLine'>[] = [];
  let mustTotal = 0;
  let meritTotal = 0;
  let mustCovered = 0;
  let meritCovered = 0;

  for (const requirement of requirements) {
    const { term, level, snippet } = requirement;
    if (level === 'must') mustTotal += 1;
    else meritTotal += 1;

    const source = evidenceByTerm.get(canonicalSkillLabel(term).toLowerCase());
    if (source) {
      if (level === 'must') mustCovered += 1;
      else meritCovered += 1;
      covered.push({ term, level, snippet, source });
    } else {
      gaps.push({ term, level, snippet });
    }
  }

  const unusedCvTerms = cvTerms.filter((term) => !skillHitsText(term, fullText));

  let confidence: MatchConfidence = 'high';
  if (description.trim().length < MIN_DESCRIPTION_LENGTH_FOR_CONFIDENCE) {
    confidence = 'low';
  } else if (mustTotal > 0 && mustTotal < 4) {
    // Thin requirement lists inflate raw coverage — stay neutral instead.
    confidence = 'low';
  } else if (mustTotal === 0 && meritTotal < 3) {
    confidence = 'low';
  }

  let score: number | null = null;
  if (mustTotal > 0) {
    score = Math.round((100 * mustCovered) / (mustTotal + SCORE_SHRINKAGE));
  } else if (meritTotal > 0) {
    score = Math.round((100 * meritCovered) / (meritTotal + SCORE_SHRINKAGE));
  }

  return {
    mustTotal,
    mustCovered,
    meritTotal,
    meritCovered,
    score: confidence === 'high' ? score : null,
    band: bandFor(score, confidence),
    confidence,
    covered,
    gaps,
    unusedCvTerms,
    cvTermsUsed: cvTerms.length - unusedCvTerms.length,
    cvTermsTotal: cvTerms.length,
  };
}

/** Build a posting-like object from a tracker row (prefers the saved ad text). */
export function postingLikeFromApplication(application: {
  title?: string | null;
  adDescription?: string | null;
  notes?: string | null;
}): PostingLike {
  const parts = [application.adDescription, application.notes].filter((part): part is string =>
    Boolean(part),
  );
  return { title: application.title ?? '', description: parts.join('\n') };
}

/** The persistable slice of a match result, stored on the application row. */
export interface MatchSnapshot {
  mustTotal: number;
  mustCovered: number;
  meritTotal: number;
  meritCovered: number;
  score: number | null;
  band: MatchBand;
  confidence: MatchConfidence;
  covered: CoveredRequirement[];
  gaps: Omit<Requirement, 'sourceLine'>[];
  unusedCvTerms: string[];
  cvTermsUsed: number;
  cvTermsTotal: number;
}

const SNAPSHOT_LIST_LIMIT = 12;

export function trimSnapshot(result: MatchResult): MatchSnapshot {
  return {
    mustTotal: result.mustTotal,
    mustCovered: result.mustCovered,
    meritTotal: result.meritTotal,
    meritCovered: result.meritCovered,
    score: result.score,
    band: result.band,
    confidence: result.confidence,
    covered: result.covered.slice(0, SNAPSHOT_LIST_LIMIT),
    gaps: result.gaps.slice(0, SNAPSHOT_LIST_LIMIT),
    unusedCvTerms: result.unusedCvTerms.slice(0, SNAPSHOT_LIST_LIMIT),
    cvTermsUsed: result.cvTermsUsed,
    cvTermsTotal: result.cvTermsTotal,
  };
}

/** Current scoring algorithm version — bump to invalidate stored snapshots. */
export const MATCH_VERSION = 3;
