/**
 * Derived facts about a tracker row: how long it has been waiting, whether the
 * follow-up is overdue, and which "lane" it belongs in on the two board views.
 *
 * All of it is computed, never stored, so a row is never stale on read.
 */

import {
  addDays,
  daysBetween,
  type IsoDate,
  monthHeading,
  parseIsoDate,
  today as todayIso,
} from './dates.ts';
import { isClosed, type Status, stageForStatus } from './statuses.ts';

/** Days without a reply before an application is flagged as waiting too long. */
export const WAIT_THRESHOLD_DAYS = 7;
/** Days after which "no response" is the honest status. */
export const STALE_NO_RESPONSE_DAYS = 45;
/** Default window to apply within, when a saved job has no deadline of its own. */
export const AUTO_APPLY_BY_DAYS = 14;

export interface LifecycleInput {
  status: Status;
  appliedAt: IsoDate | null;
  deadline: IsoDate | null;
  applyBy: IsoDate | null;
  /** True when applyBy was invented by the app (+14 days), not set by the employer. */
  applyByIsAuto?: boolean;
  nextActionAt: IsoDate | null;
  lastActivityAt: IsoDate | null;
  intent: Intent;
}

export const INTENTS = ['active', 'paused'] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Readonly<Record<Intent, string>> = {
  active: 'Ska söka',
  paused: 'Lagd på is',
};

export const APPLICATION_SOURCES = [
  'platsbanken',
  'linkedin',
  'company',
  'recruiter',
  'other',
] as const;
export type ApplicationSource = (typeof APPLICATION_SOURCES)[number];

export const SOURCE_LABELS: Readonly<Record<ApplicationSource, string>> = {
  platsbanken: 'Platsbanken',
  linkedin: 'LinkedIn',
  company: 'Företagets sida',
  recruiter: 'Rekryterare',
  other: 'Annat',
};

/**
 * Days spent waiting for a reply. Only meaningful while the row sits at "sökt";
 * once there has been contact, the wait is over.
 */
export function waitingDays(
  row: Pick<LifecycleInput, 'status' | 'appliedAt' | 'lastActivityAt'>,
  today: IsoDate = todayIso(),
): number | null {
  if (stageForStatus(row.status) !== 'sokt') return null;
  const since = row.lastActivityAt ?? row.appliedAt;
  if (!since) return null;
  return daysBetween(since, today);
}

export function isOverdue(
  row: Pick<LifecycleInput, 'status' | 'appliedAt' | 'lastActivityAt'>,
  today: IsoDate = todayIso(),
): boolean {
  const days = waitingDays(row, today);
  return days !== null && days >= WAIT_THRESHOLD_DAYS;
}

export function isStale(
  row: Pick<LifecycleInput, 'status' | 'appliedAt' | 'lastActivityAt'>,
  today: IsoDate = todayIso(),
): boolean {
  const days = waitingDays(row, today);
  return days !== null && days > STALE_NO_RESPONSE_DAYS;
}

export function isFollowUpOverdue(
  row: Pick<LifecycleInput, 'status' | 'nextActionAt'>,
  today: IsoDate = todayIso(),
): boolean {
  if (isClosed(row.status)) return false;
  return row.nextActionAt !== null && daysBetween(row.nextActionAt, today) > 0;
}

/**
 * "Sök senast" for a saved job: the ad's own deadline when it has one, otherwise
 * a two-week nudge from when it was saved. Returns null for non-wishlist rows.
 */
export function deriveApplyBy(input: {
  status: Status;
  deadline: IsoDate | null;
  createdAt: IsoDate;
}): { applyBy: IsoDate; isAuto: boolean } | null {
  if (stageForStatus(input.status) !== 'bevakad') return null;
  if (input.deadline) return { applyBy: input.deadline, isAuto: false };
  return { applyBy: addDays(input.createdAt, AUTO_APPLY_BY_DAYS), isAuto: true };
}

/**
 * The employer's real last day, if any.
 * An auto-generated applyBy must never be treated as a real deadline.
 */
export function realDeadline(
  row: Pick<LifecycleInput, 'deadline' | 'applyBy' | 'applyByIsAuto'>,
): IsoDate | null {
  if (row.deadline) return row.deadline;
  if (row.applyBy && !row.applyByIsAuto) return row.applyBy;
  return null;
}

/** What to show in the date column for a saved job. */
export function savedDueDisplay(
  row: Pick<LifecycleInput, 'deadline' | 'applyBy' | 'applyByIsAuto'>,
): {
  date: IsoDate;
  source: 'deadline' | 'reminder';
  label: string;
} | null {
  if (row.deadline) {
    return { date: row.deadline, source: 'deadline', label: 'sista dag' };
  }
  if (row.applyBy) {
    return {
      date: row.applyBy,
      source: row.applyByIsAuto ? 'reminder' : 'deadline',
      label: row.applyByIsAuto ? 'din påminnelse' : 'sök senast',
    };
  }
  return null;
}

/** Lanes on "Sparade jobb", in display order. */
export const SAVED_LANES = [
  'utgangna',
  'idag_imorgon',
  'denna_vecka',
  'senare_manad',
  'langre_fram',
  'utan_datum',
  'pa_is',
] as const;
export type SavedLane = (typeof SAVED_LANES)[number];

export const SAVED_LANE_LABELS: Readonly<Record<SavedLane, string>> = {
  utgangna: 'Utgångna',
  idag_imorgon: 'Idag–imorgon',
  denna_vecka: 'Denna vecka',
  senare_manad: 'Senare i månaden',
  langre_fram: 'Längre fram',
  utan_datum: 'Utan sista dag',
  pa_is: 'Lagt på is',
};

export const SAVED_LANE_HINTS: Readonly<Record<SavedLane, string>> = {
  utgangna: 'Sista dagen har passerat',
  idag_imorgon: 'Måste sökas nu',
  denna_vecka: 'Inom sju dagar',
  senare_manad: 'Före månadsskifte',
  langre_fram: 'Längre än innevarande månad',
  utan_datum: 'Ingen sista ansökningsdag — sätt en påminnelse om du vill',
  pa_is: 'Väntar på beslut från dig',
};

/** Dynamic lane title — "Senare i september" when we know the month. */
export function savedLaneLabel(lane: SavedLane, today: IsoDate = todayIso()): string {
  if (lane === 'senare_manad') {
    const { month } = parseIsoDate(today);
    return `Senare i ${monthHeading(month).toLowerCase()}`;
  }
  return SAVED_LANE_LABELS[lane];
}

export function savedLaneFor(
  row: Pick<LifecycleInput, 'intent' | 'applyBy' | 'deadline' | 'applyByIsAuto'>,
  today: IsoDate = todayIso(),
): SavedLane {
  if (row.intent === 'paused') return 'pa_is';

  const due = realDeadline(row);
  if (!due) return 'utan_datum';

  const daysLeft = daysBetween(today, due);
  if (daysLeft < 0) return 'utgangna';
  if (daysLeft <= 1) return 'idag_imorgon';
  if (daysLeft <= 7) return 'denna_vecka';

  const todayParts = parseIsoDate(today);
  const dueParts = parseIsoDate(due);
  if (dueParts.year === todayParts.year && dueParts.month === todayParts.month) {
    return 'senare_manad';
  }
  return 'langre_fram';
}

/** Lanes on "Ansökningar", in display order. */
export const APPLIED_LANES = [
  'vantar_for_lange',
  'nyligen_sokta',
  'i_dialog',
  'erbjudande',
  'avslutade',
] as const;
export type AppliedLane = (typeof APPLIED_LANES)[number];

export const APPLIED_LANE_LABELS: Readonly<Record<AppliedLane, string>> = {
  vantar_for_lange: 'Väntar för länge',
  nyligen_sokta: 'Nyligen sökta',
  i_dialog: 'I dialog',
  erbjudande: 'Erbjudande',
  avslutade: 'Avslutade',
};

export const APPLIED_LANE_HINTS: Readonly<Record<AppliedLane, string>> = {
  vantar_for_lange: `Inget svar på ${WAIT_THRESHOLD_DAYS} dagar — hör av dig`,
  nyligen_sokta: 'Skickade nyligen, ge det några dagar',
  i_dialog: 'Kontakt eller intervju pågår',
  erbjudande: 'Dags att svara',
  avslutade: 'Klara — avslag, inget svar eller tackade ja/nej',
};

export function appliedLaneFor(
  row: Pick<LifecycleInput, 'status' | 'appliedAt' | 'lastActivityAt'>,
  today: IsoDate = todayIso(),
): AppliedLane {
  const stage = stageForStatus(row.status);
  if (stage === 'avslutad') return 'avslutade';
  if (stage === 'erbjudande') return 'erbjudande';
  if (stage === 'kontakt' || stage === 'intervju') return 'i_dialog';
  return isOverdue(row, today) ? 'vantar_for_lange' : 'nyligen_sokta';
}

/**
 * A stable key for an employer, so "Acme AB" and "Acme  Aktiebolag" collapse
 * into one when spotting duplicate applications.
 */
const COMPANY_FORM_RE =
  /\b(aktiebolag|handelsbolag|kommanditbolag|ekonomisk\s+förening|ek\.?\s*för\.?|ab|kb|hb)\b\.?/giu;

export function employerKey(name: string): string {
  return (name ?? '')
    .normalize('NFKC')
    .replace(/&/gu, ' ')
    .replace(COMPANY_FORM_RE, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

/** Normalised role for duplicate detection. */
export function roleKey(title: string): string {
  return (title ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase();
}

/** Salary expectation is asked for at the moment of applying, not before. */
export const SALARY_CLAIM_MAX_LENGTH = 80;

/** Sentinel when the user explicitly skips stating a salary. */
export const SALARY_CLAIM_NONE = 'Angav ingen lön';

/**
 * Salary is prompted when moving to applied, but may be skipped with
 * {@link SALARY_CLAIM_NONE}. Never required for closed outcomes.
 */
export function requiresSalaryClaim(status: Status): boolean {
  return (
    stageForStatus(status) !== 'bevakad' &&
    status !== 'rejected' &&
    status !== 'no_response' &&
    status !== 'withdrawn'
  );
}

/** True when a row is being marked as applied without a salary claim on file. */
export function salaryClaimMissingOnApply(input: {
  status: Status;
  salaryClaim: string;
  previousStatus?: Status | null;
}): boolean {
  // Salary is prompted in the UI but never hard-required — empty means
  // "not stated", same as choosing „Angav ingen lön”.
  void input;
  return false;
}

/** Accept digits with optional unit, or the explicit skip sentinel. */
export function isValidSalaryClaim(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === SALARY_CLAIM_NONE) return true;
  // Allow forms like "32000", "32 000 kr", "ca 35 000/mån"
  return /\d/.test(trimmed) && trimmed.length <= SALARY_CLAIM_MAX_LENGTH;
}
