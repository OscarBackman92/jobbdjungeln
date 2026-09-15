/**
 * Överikt aggregations.
 *
 * Pure functions over already-loaded rows: the database does the filtering, this
 * module does the arithmetic, so every number on the dashboard is testable
 * without a database.
 */

import {
  addMonths,
  daysBetween,
  type IsoDate,
  parseIsoDate,
  today as todayIso,
} from './dates.ts';
import {
  type AppliedLane,
  appliedLaneFor,
  type Intent,
  isFollowUpOverdue,
  isOverdue,
  isStale,
  type SavedLane,
  savedLaneFor,
  waitingDays,
} from './lifecycle.ts';
import {
  isClosed,
  type Outcome,
  outcomeForStatus,
  type Stage,
  type Status,
  stageForStatus,
} from './statuses.ts';

export interface DashboardRow {
  id: string;
  company: string;
  title: string;
  status: Status;
  intent: Intent;
  appliedAt: IsoDate | null;
  applyBy: IsoDate | null;
  applyByIsAuto?: boolean;
  deadline: IsoDate | null;
  nextActionAt: IsoDate | null;
  lastActivityAt: IsoDate | null;
  archivedAt: Date | null;
}

export interface FunnelStep {
  stage: Stage;
  count: number;
  /** Share of applications that reached at least this stage, 0–100. */
  share: number;
}

export interface MonthlyPoint {
  key: string;
  label: string;
  applied: number;
  reachedContact: number;
}

export interface NextAction {
  id: string;
  company: string;
  title: string;
  due: IsoDate;
  kind: 'apply_by' | 'follow_up' | 'deadline';
  overdue: boolean;
}

export interface DashboardSummary {
  saved: number;
  active: number;
  waitingTooLong: number;
  inDialog: number;
  closed: number;
  responseRate: number | null;
  savedLanes: Record<SavedLane, number>;
  appliedLanes: Record<AppliedLane, number>;
  outcomes: Record<Outcome, number>;
  funnel: FunnelStep[];
  monthly: MonthlyPoint[];
  nextActions: NextAction[];
  staleCount: number;
  /** Applications per week over the last 4 weeks, rounded to one decimal. */
  pace: number;
}

const DIALOG_STAGES: readonly Stage[] = ['kontakt', 'intervju', 'erbjudande'];
const MONTHLY_WINDOW = 6;
const PACE_WINDOW_DAYS = 28;
const NEXT_ACTION_LIMIT = 8;

function emptyCounts<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

const SAVED_LANE_KEYS: readonly SavedLane[] = [
  'utgangna',
  'idag_imorgon',
  'denna_vecka',
  'senare_manad',
  'langre_fram',
  'utan_datum',
  'pa_is',
];
const APPLIED_LANE_KEYS: readonly AppliedLane[] = [
  'vantar_for_lange',
  'nyligen_sokta',
  'i_dialog',
  'erbjudande',
  'avslutade',
];
const OUTCOME_KEYS: readonly Outcome[] = [
  'avslag',
  'inget_svar',
  'aterkallad',
  'tackade_ja',
  'tackade_nej',
  'tjansten_tillsatt',
];

/**
 * Funnel counts are cumulative: a row currently at "intervju" also counted as
 * having reached "sökt" and "kontakt". Closed rows keep the furthest stage they
 * reached, which is why `furthestStage` is passed in rather than derived from
 * the current status alone.
 */
const FUNNEL_ORDER: readonly Stage[] = ['sokt', 'kontakt', 'intervju', 'erbjudande'];

export function buildFunnel(furthestStages: readonly Stage[]): FunnelStep[] {
  const applied = furthestStages.length;
  return FUNNEL_ORDER.map((stage, index) => {
    const minRank = index;
    const count = furthestStages.filter(
      (reached) => FUNNEL_ORDER.indexOf(reached) >= minRank,
    ).length;
    return {
      stage,
      count,
      share: applied === 0 ? 0 : Math.round((100 * count) / applied),
    };
  });
}

/** Monthly applied counts for the last `MONTHLY_WINDOW` months, oldest first. */
export function buildMonthly(
  rows: readonly Pick<DashboardRow, 'appliedAt' | 'status'>[],
  reachedContactIds: ReadonlySet<string> = new Set(),
  rowIds: readonly string[] = [],
  today: IsoDate = todayIso(),
): MonthlyPoint[] {
  const { year, month } = parseIsoDate(today);
  const points: MonthlyPoint[] = [];

  for (let offset = MONTHLY_WINDOW - 1; offset >= 0; offset -= 1) {
    const target = parseIsoDate(
      addMonths(`${year}-${`${month}`.padStart(2, '0')}-01`, -offset),
    );
    const key = `${target.year}-${`${target.month}`.padStart(2, '0')}`;
    let applied = 0;
    let reachedContact = 0;
    for (const [index, row] of rows.entries()) {
      if (!row.appliedAt?.startsWith(key)) continue;
      applied += 1;
      const id = rowIds[index];
      if (id !== undefined && reachedContactIds.has(id)) reachedContact += 1;
    }
    points.push({ key, label: key, applied, reachedContact });
  }
  return points;
}

export function buildNextActions(
  rows: readonly DashboardRow[],
  today: IsoDate = todayIso(),
): NextAction[] {
  const actions: NextAction[] = [];

  for (const row of rows) {
    if (row.archivedAt) continue;
    if (isClosed(row.status)) continue;

    if (row.nextActionAt) {
      actions.push({
        id: row.id,
        company: row.company,
        title: row.title,
        due: row.nextActionAt,
        kind: 'follow_up',
        overdue: isFollowUpOverdue(row, today),
      });
    } else if (stageForStatus(row.status) === 'bevakad') {
      const due = row.deadline ?? (row.applyByIsAuto ? null : row.applyBy) ?? row.applyBy;
      if (due) {
        actions.push({
          id: row.id,
          company: row.company,
          title: row.title,
          due,
          // `applyByIsAuto` defaults to "auto nudge" when omitted — only an
          // explicit false (user-set date) or a real ad deadline is a deadline.
          kind: row.deadline
            ? 'deadline'
            : row.applyByIsAuto === false
              ? 'deadline'
              : 'apply_by',
          overdue: daysBetween(due, today) > 0,
        });
      }
    }
  }

  return actions
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
    .slice(0, NEXT_ACTION_LIMIT);
}

export interface SummaryInput {
  rows: readonly DashboardRow[];
  /** Furthest stage each *applied* row ever reached, keyed by row id. */
  furthestStageById: ReadonlyMap<string, Stage>;
  today?: IsoDate;
}

export function buildSummary({
  rows,
  furthestStageById,
  today = todayIso(),
}: SummaryInput): DashboardSummary {
  const live = rows.filter((row) => !row.archivedAt);
  const savedLanes = emptyCounts(SAVED_LANE_KEYS);
  const appliedLanes = emptyCounts(APPLIED_LANE_KEYS);
  const outcomes = emptyCounts(OUTCOME_KEYS);

  let saved = 0;
  let active = 0;
  let waitingTooLong = 0;
  let inDialog = 0;
  let closed = 0;
  let staleCount = 0;

  for (const row of live) {
    const stage = stageForStatus(row.status);
    if (stage === 'bevakad') {
      saved += 1;
      savedLanes[savedLaneFor(row, today)] += 1;
      continue;
    }

    appliedLanes[appliedLaneFor(row, today)] += 1;
    if (stage === 'avslutad') {
      closed += 1;
      const outcome = outcomeForStatus(row.status);
      if (outcome) outcomes[outcome] += 1;
      continue;
    }

    active += 1;
    if (DIALOG_STAGES.includes(stage)) inDialog += 1;
    if (isOverdue(row, today)) waitingTooLong += 1;
    if (isStale(row, today)) staleCount += 1;
  }

  const appliedRows = live.filter((row) => stageForStatus(row.status) !== 'bevakad');
  const furthest = appliedRows.map(
    (row) => furthestStageById.get(row.id) ?? stageForStatus(row.status),
  );
  const answered = furthest.filter((stage) => stage !== 'sokt').length;
  // A percentage on n < 5 is noise and demoralising — hide it until there is a sample.
  const RESPONSE_RATE_MIN = 5;
  const responseRate =
    appliedRows.length < RESPONSE_RATE_MIN
      ? null
      : Math.round((100 * answered) / appliedRows.length);

  const reachedContactIds = new Set(
    appliedRows
      .filter((row) => {
        const stage = furthestStageById.get(row.id) ?? stageForStatus(row.status);
        return stage !== 'sokt' && stage !== 'avslutad';
      })
      .map((row) => row.id),
  );

  const recentApplied = appliedRows.filter(
    (row) => row.appliedAt && daysBetween(row.appliedAt, today) <= PACE_WINDOW_DAYS,
  ).length;

  return {
    saved,
    active,
    waitingTooLong,
    inDialog,
    closed,
    responseRate,
    savedLanes,
    appliedLanes,
    outcomes,
    funnel: buildFunnel(furthest),
    monthly: buildMonthly(
      appliedRows,
      reachedContactIds,
      appliedRows.map((row) => row.id),
      today,
    ),
    nextActions: buildNextActions(live, today),
    staleCount,
    pace: Math.round((recentApplied / (PACE_WINDOW_DAYS / 7)) * 10) / 10,
  };
}

export { waitingDays };
