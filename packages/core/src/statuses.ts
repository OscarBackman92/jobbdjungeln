/**
 * The application pipeline: one status axis (public API value) projected onto
 * two canonical axes — `stage` (where the row is) and `outcome` (how it ended).
 *
 * Saved jobs (`wishlist`) and real applications live in the same table; the two
 * views differ only by stage.
 */

export const STATUSES = [
  'wishlist',
  'applied',
  'screening',
  'interview',
  'forwarded',
  'offer',
  'accepted',
  'rejected',
  'no_response',
  'withdrawn',
] as const;

export type Status = (typeof STATUSES)[number];

export const STAGES = [
  'bevakad',
  'sokt',
  'kontakt',
  'intervju',
  'erbjudande',
  'avslutad',
] as const;

export type Stage = (typeof STAGES)[number];

export const OUTCOMES = [
  'avslag',
  'inget_svar',
  'aterkallad',
  'tackade_ja',
  'tackade_nej',
  'tjansten_tillsatt',
] as const;

export type Outcome = (typeof OUTCOMES)[number];

export const STATUS_LABELS: Readonly<Record<Status, string>> = {
  wishlist: 'Sparad',
  applied: 'Ansökt',
  screening: 'Telefonintervju',
  interview: 'Intervju',
  forwarded: 'Skickad vidare',
  offer: 'Erbjudande',
  accepted: 'Accepterat',
  rejected: 'Avslag',
  no_response: 'Inget svar',
  withdrawn: 'Återkallad',
};

export const STAGE_LABELS: Readonly<Record<Stage, string>> = {
  bevakad: 'Bevakad',
  sokt: 'Sökt',
  kontakt: 'Kontakt',
  intervju: 'Intervju',
  erbjudande: 'Erbjudande',
  avslutad: 'Avslutad',
};

export const OUTCOME_LABELS: Readonly<Record<Outcome, string>> = {
  avslag: 'Avslag',
  inget_svar: 'Inget svar',
  aterkallad: 'Återkallad',
  tackade_ja: 'Tackade ja',
  tackade_nej: 'Tackade nej',
  tjansten_tillsatt: 'Tjänsten tillsatt',
};

const STATUS_PROJECTION: Readonly<Record<Status, { stage: Stage; outcome: Outcome | null }>> = {
  wishlist: { stage: 'bevakad', outcome: null },
  applied: { stage: 'sokt', outcome: null },
  screening: { stage: 'kontakt', outcome: null },
  forwarded: { stage: 'kontakt', outcome: null },
  interview: { stage: 'intervju', outcome: null },
  offer: { stage: 'erbjudande', outcome: null },
  accepted: { stage: 'avslutad', outcome: 'tackade_ja' },
  rejected: { stage: 'avslutad', outcome: 'avslag' },
  no_response: { stage: 'avslutad', outcome: 'inget_svar' },
  withdrawn: { stage: 'avslutad', outcome: 'aterkallad' },
};

/** Statuses that mean the user has actually applied. */
export const APPLIED_STATUSES: readonly Status[] = [
  'applied',
  'screening',
  'interview',
  'forwarded',
  'offer',
  'accepted',
];

export function isStatus(value: unknown): value is Status {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value);
}

export function isStage(value: unknown): value is Stage {
  return typeof value === 'string' && (STAGES as readonly string[]).includes(value);
}

/**
 * How far along the pipeline each stage is.
 *
 * "avslutad" sits below everything: closing a row says how it ended, not how
 * far it got, so a rejection must not erase an interview.
 */
const STAGE_RANK: Readonly<Record<Stage, number>> = {
  avslutad: -1,
  bevakad: 0,
  sokt: 1,
  kontakt: 2,
  intervju: 3,
  erbjudande: 4,
};

/** The furthest stage a row has reached — a closed row keeps how far it got. */
export function furthestStage(previous: string, next: string): Stage {
  const prev = isStage(previous) ? previous : 'sokt';
  const nxt = isStage(next) ? next : 'sokt';
  return (STAGE_RANK[nxt] ?? 0) > (STAGE_RANK[prev] ?? 0) ? nxt : prev;
}

/**
 * Where a brand-new row starts on the pipeline. A row created as already
 * rejected still counts as applied for — that is how it came to be rejected.
 */
export function initialFurthestStage(status: Status): Stage {
  const stage = stageForStatus(status);
  return stage === 'avslutad' ? 'sokt' : stage;
}

/** Employer actually replied — including rejection. Not silence or a withdrawal. */
export const GOT_REPLY_STATUSES: readonly Status[] = [
  'screening',
  'interview',
  'forwarded',
  'offer',
  'accepted',
  'rejected',
];

export function gotReply(status: Status): boolean {
  return GOT_REPLY_STATUSES.includes(status);
}

export function stageForStatus(status: Status): Stage {
  return STATUS_PROJECTION[status].stage;
}

export function outcomeForStatus(status: Status): Outcome | null {
  return STATUS_PROJECTION[status].outcome;
}

export function isWishlist(status: Status): boolean {
  return stageForStatus(status) === 'bevakad';
}

export function isClosed(status: Status): boolean {
  return stageForStatus(status) === 'avslutad';
}

export function hasApplied(status: Status): boolean {
  return APPLIED_STATUSES.includes(status);
}

/**
 * Statuses the UI may offer from `status`, excluding the current one.
 *
 * From Sparad only Ansökt and Återkallad. From any application status, every
 * other application status is reachable so the user can correct the pipeline.
 */
export function allowedNextStatuses(status: Status): Status[] {
  if (status === 'wishlist') {
    return ['applied', 'withdrawn'];
  }
  return STATUSES.filter((candidate) => candidate !== 'wishlist' && candidate !== status);
}

export function isTransitionAllowed(from: Status, to: Status): boolean {
  if (from === to) return true;
  return allowedNextStatuses(from).includes(to);
}

/** Menu groups for the applied-board status picker. */
export const STATUS_MENU_GROUPS = [
  {
    label: 'Pågående',
    statuses: [
      'applied',
      'forwarded',
      'screening',
      'interview',
      'offer',
      'accepted',
    ] as const satisfies readonly Status[],
  },
  {
    label: 'Avslutad',
    statuses: ['rejected', 'no_response', 'withdrawn'] as const satisfies readonly Status[],
  },
] as const;

/** Ordered pipeline used by the funnel chart; terminal statuses are excluded. */
export const PIPELINE_STAGES: readonly Stage[] = [
  'bevakad',
  'sokt',
  'kontakt',
  'intervju',
  'erbjudande',
];
