/**
 * Django → Jobbdjungeln ETL.
 *
 * Reads a dump of the old app (auth_user, core_*, allauth) and maps it onto
 * the new schema. The source is SELECT-only — never INSERT/UPDATE/DELETE.
 * Passwords are not copied; each imported user gets a credential account
 * without a usable hash so "glömt lösenord" is the sign-in path.
 */

import {
  ACTIVITY_TYPES,
  APPLICATION_SOURCES,
  type ApplicationSource,
  employerKey,
  furthestStage,
  INTENTS,
  initialFurthestStage,
  isIsoDate,
  isStage,
  isStatus,
  normalizeAdUrl,
  OUTCOMES,
  type Outcome,
  type Stage,
  type Status,
  stageForStatus,
} from '@jobbdjungeln/core';
import { eq } from 'drizzle-orm';
import { operatorId } from './operator-id.ts';
import type { JobProfile, ResumeEducation, ResumeExperience } from './schema.ts';
import * as t from './schema.ts';

const WRITE_SQL =
  /\b(insert|update|delete|drop|alter|truncate|create|grant|revoke|copy|call|do)\b/i;

export function assertReadOnlySql(sql: string): void {
  const stripped = sql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim();
  if (!/^select\b/i.test(stripped)) {
    throw new Error('Källan får bara läsas med SELECT.');
  }
  if (WRITE_SQL.test(stripped)) {
    throw new Error('Källan får inte ta emot skrivningar.');
  }
}

export type QueryRows = <T extends Record<string, unknown>>(sql: string) => Promise<T[]>;

export interface DjangoUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  dateJoined: Date | null;
  lastLogin: Date | null;
}

export interface DjangoEmail {
  userId: number;
  email: string;
  verified: boolean;
  primary: boolean;
}

export interface DjangoProfile {
  userId: number;
  operatorId: string;
  deletionWarnedAt: Date | null;
  weeklySummarySentAt: Date | null;
}

export interface DjangoApplication {
  id: number;
  ownerId: number;
  company: string;
  title: string;
  location: string;
  adUrl: string;
  applyUrl: string;
  adDescription: string;
  sourceJobId: string;
  source: string;
  status: string;
  outcome: string;
  intent: string;
  applyBy: string | null;
  applyByIsAuto: boolean;
  appliedAt: string | null;
  deadline: string | null;
  nextActionAt: string | null;
  closedAt: Date | null;
  archivedAt: Date | null;
  salaryClaim: string;
  contactName: string;
  contactInfo: string;
  notes: string;
  occupationConceptId: string;
  occupationLabel: string;
  occupationGroupLabel: string;
  workingHoursType: string;
  scopeOfWorkMin: number | null;
  scopeOfWorkMax: number | null;
  matchScore: number | null;
  matchSnapshot: unknown;
  matchVersion: number;
  matchScoredAt: Date | null;
  matchProfileId: string;
  reportExcluded: boolean;
  reportNote: string;
  reportedInId: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface DjangoEvent {
  id: number;
  applicationId: number;
  occurredAt: string | null;
  note: string;
  status: string;
  eventType: string;
  fromStage: string;
  toStage: string;
  isReportable: boolean;
  reportExcluded: boolean;
  reportedInId: number | null;
  createdAt: Date | null;
}

export interface DjangoSearch {
  id: number;
  ownerId: number;
  label: string;
  query: string;
  regions: unknown;
  municipalities: unknown;
  occupationFields: unknown;
  occupationGroups: unknown;
  remote: boolean;
  matchCv: boolean;
  digestCheckedAt: Date | null;
  createdAt: Date | null;
}

export interface DjangoResume {
  userId: number;
  headline: string;
  summary: string;
  skills: unknown;
  skillGroups: unknown;
  experience: unknown;
  education: unknown;
  jobProfiles: unknown;
  updatedAt: Date | null;
}

export interface DjangoPeriod {
  id: number;
  userId: number;
  year: number;
  month: number;
  submittedAt: Date | null;
  note: string;
  createdAt: Date | null;
}

export interface DjangoActivity {
  id: number;
  userId: number;
  type: string;
  occurredOn: string | null;
  title: string;
  organisation: string;
  note: string;
  jobId: number | null;
  reportExcluded: boolean;
  reportNote: string;
  reportedInId: number | null;
}

export interface DjangoDump {
  users: DjangoUser[];
  emails: DjangoEmail[];
  profiles: DjangoProfile[];
  applications: DjangoApplication[];
  events: DjangoEvent[];
  searches: DjangoSearch[];
  resumes: DjangoResume[];
  periods: DjangoPeriod[];
  activities: DjangoActivity[];
}

export interface ImportReport {
  errors: string[];
  warnings: string[];
  counts: {
    source: Record<string, number>;
    target: Record<string, number>;
    skippedInactiveUsers: number;
  };
  resetEmails: string[];
}

export interface PlannedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  operatorId: string;
  deletionWarnedAt: Date | null;
  weeklySummarySentAt: Date | null;
  lastSeenAt: Date;
  weeklySummaryOptIn: boolean;
  reminderOptIn: boolean;
}

export interface PlannedAccount {
  id: string;
  accountId: string;
  providerId: 'credential';
  userId: string;
  password: null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannedApplication {
  id: string;
  userId: string;
  company: string;
  title: string;
  location: string;
  adUrl: string;
  adUrlKey: string;
  applyUrl: string;
  adDescription: string;
  sourceJobId: string;
  source: ApplicationSource | null;
  status: Status;
  stage: Stage;
  outcome: Outcome | null;
  furthestStage: Stage;
  employerKey: string;
  occupationConceptId: string;
  occupationLabel: string;
  occupationGroupLabel: string;
  workingHoursType: string;
  scopeOfWorkMin: number | null;
  scopeOfWorkMax: number | null;
  intent: (typeof INTENTS)[number];
  applyBy: string | null;
  applyByIsAuto: boolean;
  appliedAt: string | null;
  deadline: string | null;
  nextActionAt: string | null;
  lastActivityAt: string | null;
  closedAt: Date | null;
  archivedAt: Date | null;
  salaryClaim: string;
  contactName: string;
  contactInfo: string;
  notes: string;
  matchScore: number | null;
  matchSnapshot: Record<string, unknown> | null;
  matchVersion: number;
  matchScoredAt: Date | null;
  reportExcluded: boolean;
  reportNote: string;
  createdAt: Date;
  updatedAt: Date;
  djangoReportedInId: number | null;
}

export interface PlannedEvent {
  id: string;
  applicationId: string;
  occurredAt: string;
  note: string;
  status: Status | null;
  fromStage: Stage | null;
  toStage: Stage | null;
  eventType: string;
  origin: 'import';
  isReportable: boolean;
  reportExcluded: boolean;
  createdAt: Date;
  djangoReportedInId: number | null;
}

export interface PlannedSearch {
  id: string;
  userId: string;
  label: string;
  query: string;
  regions: string[];
  municipalities: string[];
  occupationFields: string[];
  occupationGroups: string[];
  remote: boolean;
  matchCv: boolean;
  digestCheckedAt: Date | null;
  digestOptIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannedResume {
  userId: string;
  headline: string;
  summary: string;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  jobProfiles: JobProfile[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannedPeriod {
  id: string;
  djangoId: number;
  userId: string;
  year: number;
  month: number;
  submittedAt: Date | null;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannedActivity {
  id: string;
  userId: string;
  type: (typeof ACTIVITY_TYPES)[number];
  occurredOn: string;
  title: string;
  organisation: string;
  note: string;
  applicationId: string | null;
  reportExcluded: boolean;
  reportNote: string;
  djangoReportedInId: number | null;
}

export interface PlannedImport {
  report: ImportReport;
  users: PlannedUser[];
  accounts: PlannedAccount[];
  applications: PlannedApplication[];
  events: PlannedEvent[];
  searches: PlannedSearch[];
  resumes: PlannedResume[];
  periods: PlannedPeriod[];
  activities: PlannedActivity[];
}

export interface IdFactory {
  uuid: () => string;
}

const SOURCES = new Set<string>(APPLICATION_SOURCES);
const ACTIVITY_SET = new Set<string>(ACTIVITY_TYPES);
const INTENT_SET = new Set<string>(INTENTS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item).trim()).filter(Boolean);
}

function asInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/** Calendar dates from Django `date` columns — take the yyyy-mm-dd prefix, never a TZ shift. */
export function isoDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1] && isIsoDate(match[1]) ? match[1] : null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return null;
}

function maxIsoDate(dates: Array<string | null | undefined>): string | null {
  const valid = dates.filter((value): value is string => Boolean(value && isIsoDate(value)));
  if (valid.length === 0) return null;
  return valid.reduce((best, value) => (value > best ? value : best));
}

function splitYears(years: string): { start: string; end: string } {
  const text = years.replace(/[–—]/g, '-').trim();
  if (!text) return { start: '', end: '' };
  const [start = '', end = ''] = text.split(/\s*-\s*/, 2);
  return { start, end };
}

function displayName(first: string, last: string, email: string): string {
  const name = `${first.trim()} ${last.trim()}`.trim();
  return name || email.split('@')[0] || email;
}

function optionalStage(value: string): Stage | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isStage(trimmed) ? trimmed : null;
}

function optionalStatus(value: string): Status | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return isStatus(trimmed) ? trimmed : null;
}

function optionalOutcome(value: string): Outcome | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return (OUTCOMES as readonly string[]).includes(trimmed) ? (trimmed as Outcome) : null;
}

function mapSource(value: string): ApplicationSource | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return SOURCES.has(trimmed) ? (trimmed as ApplicationSource) : null;
}

function snapshotObject(raw: unknown, matchProfileId: string): Record<string, unknown> | null {
  const base = isRecord(raw) ? { ...raw } : raw == null || raw === '' ? {} : null;
  if (base === null) return matchProfileId ? { matchProfileId } : null;
  const empty = Object.keys(base).length === 0;
  if (matchProfileId) base.matchProfileId = matchProfileId;
  if (empty && !matchProfileId) return null;
  return base;
}

export function mapExperience(raw: unknown, id: (index: number) => string): ResumeExperience[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const row = isRecord(item) ? item : {};
    const years = splitYears(asString(row.years));
    return {
      id: asString(row.id) || id(index),
      role: asString(row.role || row.title),
      employer: asString(row.employer || row.company),
      start: asString(row.start) || years.start,
      end: asString(row.end) || years.end,
      description: asString(row.description),
      skills: asStringList(row.skills),
    };
  });
}

export function mapEducation(raw: unknown, id: (index: number) => string): ResumeEducation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const row = isRecord(item) ? item : {};
    const years = splitYears(asString(row.years));
    return {
      id: asString(row.id) || id(index),
      program: asString(row.program || row.degree),
      school: asString(row.school),
      start: asString(row.start) || years.start,
      end: asString(row.end) || years.end,
    };
  });
}

function flattenSkillGroups(raw: unknown): string[] {
  if (!isRecord(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of ['technical', 'domain', 'languages']) {
    for (const item of asStringList(raw[key])) {
      const lowered = item.toLowerCase();
      if (seen.has(lowered)) continue;
      seen.add(lowered);
      out.push(item);
    }
  }
  return out;
}

export function mapJobProfiles(
  raw: unknown,
  skillGroups: unknown,
  headline: string,
  id: () => string,
): JobProfile[] {
  if (Array.isArray(raw) && raw.length > 0) {
    return raw
      .filter(isRecord)
      .slice(0, 10)
      .map((item) => {
        if (Array.isArray(item.skills) && item.skills.length > 0) {
          return {
            id: asString(item.id) || id(),
            label: asString(item.label).slice(0, 80) || headline.trim() || 'Mitt jobbsök',
            skills: asStringList(item.skills),
            confirmed: asStringList(item.confirmed),
          };
        }
        const evidence = Array.isArray(item.evidence) ? item.evidence.filter(isRecord) : [];
        const terms = evidence.map((entry) => asString(entry.term).trim()).filter(Boolean);
        const confirmed = evidence
          .filter((entry) => entry.confirmed !== false)
          .map((entry) => asString(entry.term).trim())
          .filter(Boolean);
        return {
          id: asString(item.id) || id(),
          label: asString(item.label).slice(0, 80) || headline.trim() || 'Mitt jobbsök',
          skills: terms,
          confirmed,
        };
      });
  }

  const fromGroups = flattenSkillGroups(skillGroups);
  if (fromGroups.length === 0) return [];
  return [
    {
      id: id(),
      label: headline.trim() || 'Mitt jobbsök',
      skills: fromGroups,
      confirmed: fromGroups,
    },
  ];
}

function applicationFurthest(status: Status, events: DjangoEvent[]): Stage {
  let current = initialFurthestStage(status);
  for (const event of events) {
    const to = optionalStage(event.toStage);
    if (to) current = furthestStage(current, to);
    const eventStatus = optionalStatus(event.status);
    if (eventStatus) current = furthestStage(current, stageForStatus(eventStatus));
  }
  return furthestStage(current, stageForStatus(status));
}

export function planImport(
  dump: DjangoDump,
  ids: IdFactory = { uuid: () => crypto.randomUUID() },
): PlannedImport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const emailsByUser = new Map<number, DjangoEmail[]>();
  for (const row of dump.emails) {
    const list = emailsByUser.get(row.userId) ?? [];
    list.push(row);
    emailsByUser.set(row.userId, list);
  }
  const profilesByUser = new Map(dump.profiles.map((row) => [row.userId, row]));

  const activeUsers = dump.users.filter((user) => user.isActive);
  const skippedInactiveUsers = dump.users.length - activeUsers.length;
  const keptUserIds = new Set(activeUsers.map((user) => user.id));

  const userMap = new Map<number, string>();
  const usedEmails = new Map<string, number>();
  const usedOperators = new Map<string, number>();
  const users: PlannedUser[] = [];
  const accounts: PlannedAccount[] = [];

  for (const user of activeUsers) {
    const addresses = emailsByUser.get(user.id) ?? [];
    const primary = addresses.find((row) => row.primary) ?? addresses[0];
    const email = (primary?.email || user.email).trim().toLowerCase();
    if (!email) {
      warnings.push(`hoppar över användare ${user.id}: saknar e-post`);
      keptUserIds.delete(user.id);
      continue;
    }
    const existingEmail = usedEmails.get(email);
    if (existingEmail !== undefined) {
      errors.push(`e-postkollision: ${email} (användare ${existingEmail} och ${user.id})`);
      continue;
    }
    usedEmails.set(email, user.id);

    const profile = profilesByUser.get(user.id);
    let nextOperator = (profile?.operatorId ?? '').trim();
    if (!nextOperator) {
      nextOperator = operatorId();
      warnings.push(`användare ${user.id} saknade operator_id; tilldelad ${nextOperator}`);
    }
    const existingOperator = usedOperators.get(nextOperator);
    if (existingOperator !== undefined) {
      errors.push(
        `operator_id-kollision: ${nextOperator} (användare ${existingOperator} och ${user.id})`,
      );
      continue;
    }
    usedOperators.set(nextOperator, user.id);

    const id = ids.uuid();
    userMap.set(user.id, id);
    const createdAt = asDate(user.dateJoined) ?? new Date(0);
    const lastSeenAt = asDate(user.lastLogin) ?? createdAt;
    users.push({
      id,
      name: displayName(user.firstName, user.lastName, email),
      email,
      emailVerified: Boolean(primary?.verified),
      createdAt,
      updatedAt: createdAt,
      operatorId: nextOperator.slice(0, 16),
      deletionWarnedAt: profile?.deletionWarnedAt ?? null,
      weeklySummarySentAt: profile?.weeklySummarySentAt ?? null,
      lastSeenAt,
      weeklySummaryOptIn: false,
      reminderOptIn: true,
    });
    accounts.push({
      id: ids.uuid(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password: null,
      createdAt,
      updatedAt: createdAt,
    });
  }

  const periods: PlannedPeriod[] = [];
  for (const row of dump.periods) {
    const userId = userMap.get(row.userId);
    if (!userId) {
      if (keptUserIds.has(row.userId)) errors.push(`rapportperiod ${row.id} saknar användare`);
      continue;
    }
    const createdAt = asDate(row.createdAt) ?? new Date(0);
    periods.push({
      id: ids.uuid(),
      djangoId: row.id,
      userId,
      year: row.year,
      month: row.month,
      submittedAt: row.submittedAt,
      note: row.note,
      createdAt,
      updatedAt: createdAt,
    });
  }

  const eventsByApplication = new Map<number, DjangoEvent[]>();
  for (const event of dump.events) {
    const list = eventsByApplication.get(event.applicationId) ?? [];
    list.push(event);
    eventsByApplication.set(event.applicationId, list);
  }

  const applicationMap = new Map<number, string>();
  const applications: PlannedApplication[] = [];
  const events: PlannedEvent[] = [];

  for (const row of dump.applications) {
    const userId = userMap.get(row.ownerId);
    if (!userId) {
      if (keptUserIds.has(row.ownerId)) {
        errors.push(`ansökan ${row.id} saknar användare ${row.ownerId}`);
      }
      continue;
    }
    if (!isStatus(row.status)) {
      errors.push(`ansökan ${row.id} har ogiltig status ${row.status || '(tom)'}`);
      continue;
    }
    const appEvents = eventsByApplication.get(row.id) ?? [];
    const id = ids.uuid();
    applicationMap.set(row.id, id);
    const appliedAt = isoDate(row.appliedAt);
    const createdAt = asDate(row.createdAt) ?? new Date(0);
    const source = mapSource(row.source);
    if (row.source.trim() && !source) {
      warnings.push(`ansökan ${row.id} har okänd källa ${row.source}; satt till null`);
    }
    const intent = INTENT_SET.has(row.intent)
      ? (row.intent as (typeof INTENTS)[number])
      : 'active';
    applications.push({
      id,
      userId,
      company: row.company,
      title: row.title,
      location: row.location,
      adUrl: row.adUrl,
      adUrlKey: normalizeAdUrl(row.adUrl),
      applyUrl: row.applyUrl,
      adDescription: row.adDescription,
      sourceJobId: row.sourceJobId,
      source,
      status: row.status,
      stage: stageForStatus(row.status),
      outcome: optionalOutcome(row.outcome),
      furthestStage: applicationFurthest(row.status, appEvents),
      employerKey: employerKey(row.company),
      occupationConceptId: row.occupationConceptId,
      occupationLabel: row.occupationLabel,
      occupationGroupLabel: row.occupationGroupLabel,
      workingHoursType: row.workingHoursType,
      scopeOfWorkMin: row.scopeOfWorkMin,
      scopeOfWorkMax: row.scopeOfWorkMax,
      intent,
      applyBy: isoDate(row.applyBy),
      applyByIsAuto: row.applyByIsAuto,
      appliedAt,
      deadline: isoDate(row.deadline),
      nextActionAt: isoDate(row.nextActionAt),
      lastActivityAt: maxIsoDate([
        appliedAt,
        ...appEvents.map((event) => isoDate(event.occurredAt)),
      ]),
      closedAt: row.closedAt,
      archivedAt: row.archivedAt,
      salaryClaim: row.salaryClaim,
      contactName: row.contactName,
      contactInfo: row.contactInfo,
      notes: row.notes,
      matchScore: row.matchScore,
      matchSnapshot: snapshotObject(row.matchSnapshot, row.matchProfileId.trim()),
      matchVersion: row.matchVersion || 0,
      matchScoredAt: row.matchScoredAt,
      reportExcluded: row.reportExcluded,
      reportNote: row.reportNote,
      createdAt,
      updatedAt: asDate(row.updatedAt) ?? createdAt,
      djangoReportedInId: row.reportedInId,
    });

    for (const event of appEvents) {
      const occurredAt = isoDate(event.occurredAt);
      if (!occurredAt) {
        errors.push(`händelse ${event.id} saknar giltigt datum`);
        continue;
      }
      if (event.status.trim() && !isStatus(event.status)) {
        errors.push(`händelse ${event.id} har ogiltig status ${event.status}`);
        continue;
      }
      if (event.fromStage.trim() && !isStage(event.fromStage)) {
        errors.push(`händelse ${event.id} har ogiltig from_stage ${event.fromStage}`);
        continue;
      }
      if (event.toStage.trim() && !isStage(event.toStage)) {
        errors.push(`händelse ${event.id} har ogiltig to_stage ${event.toStage}`);
        continue;
      }
      events.push({
        id: ids.uuid(),
        applicationId: id,
        occurredAt,
        note: event.note.slice(0, 500),
        status: optionalStatus(event.status),
        fromStage: optionalStage(event.fromStage),
        toStage: optionalStage(event.toStage),
        eventType: event.eventType,
        origin: 'import',
        isReportable: event.isReportable,
        reportExcluded: event.reportExcluded,
        createdAt: asDate(event.createdAt) ?? createdAt,
        djangoReportedInId: event.reportedInId,
      });
    }
  }

  for (const event of dump.events) {
    if (applicationMap.has(event.applicationId)) continue;
    const app = dump.applications.find((row) => row.id === event.applicationId);
    if (!app || !keptUserIds.has(app.ownerId)) continue;
    errors.push(`händelse ${event.id} saknar ansökan ${event.applicationId}`);
  }

  const searches: PlannedSearch[] = [];
  for (const row of dump.searches) {
    const userId = userMap.get(row.ownerId);
    if (!userId) {
      if (keptUserIds.has(row.ownerId))
        errors.push(`sparad sökning ${row.id} saknar användare`);
      continue;
    }
    const createdAt = asDate(row.createdAt) ?? new Date(0);
    searches.push({
      id: ids.uuid(),
      userId,
      label: row.label,
      query: row.query,
      regions: asStringList(row.regions),
      municipalities: asStringList(row.municipalities),
      occupationFields: asStringList(row.occupationFields),
      occupationGroups: asStringList(row.occupationGroups),
      remote: row.remote,
      matchCv: row.matchCv,
      digestCheckedAt: row.digestCheckedAt,
      digestOptIn: true,
      createdAt,
      updatedAt: createdAt,
    });
  }

  const resumes: PlannedResume[] = [];
  for (const row of dump.resumes) {
    const userId = userMap.get(row.userId);
    if (!userId) {
      if (keptUserIds.has(row.userId)) errors.push(`CV ${row.userId} saknar användare`);
      continue;
    }
    const skills = asStringList(row.skills);
    const updatedAt = asDate(row.updatedAt) ?? new Date(0);
    resumes.push({
      userId,
      headline: row.headline,
      summary: row.summary,
      skills,
      experience: mapExperience(row.experience, (index) => `exp-${index}`),
      education: mapEducation(row.education, (index) => `edu-${index}`),
      jobProfiles: mapJobProfiles(row.jobProfiles, row.skillGroups, row.headline, () =>
        ids.uuid().slice(0, 12),
      ),
      createdAt: updatedAt,
      updatedAt,
    });
  }

  const activities: PlannedActivity[] = [];
  for (const row of dump.activities) {
    const userId = userMap.get(row.userId);
    if (!userId) {
      if (keptUserIds.has(row.userId)) errors.push(`aktivitet ${row.id} saknar användare`);
      continue;
    }
    if (!ACTIVITY_SET.has(row.type)) {
      errors.push(`aktivitet ${row.id} har ogiltig typ ${row.type}`);
      continue;
    }
    const occurredOn = isoDate(row.occurredOn);
    if (!occurredOn) {
      errors.push(`aktivitet ${row.id} saknar giltigt datum`);
      continue;
    }
    let applicationId: string | null = null;
    if (row.jobId != null) {
      applicationId = applicationMap.get(row.jobId) ?? null;
      if (!applicationId) {
        warnings.push(`aktivitet ${row.id} pekar på saknad ansökan ${row.jobId}`);
      }
    }
    activities.push({
      id: ids.uuid(),
      userId,
      type: row.type as (typeof ACTIVITY_TYPES)[number],
      occurredOn,
      title: row.title,
      organisation: row.organisation,
      note: row.note,
      applicationId,
      reportExcluded: row.reportExcluded,
      reportNote: row.reportNote,
      djangoReportedInId: row.reportedInId,
    });
  }

  return {
    report: {
      errors,
      warnings,
      resetEmails: users.map((user) => user.email),
      counts: {
        skippedInactiveUsers,
        source: {
          users: dump.users.length,
          emails: dump.emails.length,
          profiles: dump.profiles.length,
          applications: dump.applications.length,
          events: dump.events.length,
          searches: dump.searches.length,
          resumes: dump.resumes.length,
          periods: dump.periods.length,
          activities: dump.activities.length,
        },
        target: {
          users: users.length,
          accounts: accounts.length,
          applications: applications.length,
          events: events.length,
          searches: searches.length,
          resumes: resumes.length,
          periods: periods.length,
          activities: activities.length,
        },
      },
    },
    users,
    accounts,
    applications,
    events,
    searches,
    resumes,
    periods,
    activities,
  };
}

function numberField(row: Record<string, unknown>, key: string): number {
  const value = asInt(row[key]);
  if (value == null) throw new Error(`saknar heltal ${key}`);
  return value;
}

function optionalNumber(row: Record<string, unknown>, key: string): number | null {
  const value = row[key];
  if (value == null || value === '') return null;
  return asInt(value);
}

function boolField(row: Record<string, unknown>, key: string, fallback = false): boolean {
  const value = row[key];
  if (typeof value === 'boolean') return value;
  if (value == null) return fallback;
  return Boolean(value);
}

export async function fetchDjangoDump(query: QueryRows): Promise<DjangoDump> {
  const users = await query<Record<string, unknown>>(`
    select id, email, first_name, last_name, is_active, date_joined, last_login
    from auth_user
  `);
  const emails = await query<Record<string, unknown>>(`
    select user_id, email, verified, "primary"
    from account_emailaddress
  `);
  const profiles = await query<Record<string, unknown>>(`
    select user_id, operator_id, deletion_warned_at, weekly_summary_sent_at
    from core_operatorprofile
  `);
  const applications = await query<Record<string, unknown>>(`
    select id, owner_id, company, title, location, ad_url, apply_url, ad_description,
           source_job_id, source, status, stage, outcome, intent, apply_by, apply_by_is_auto,
           applied_at, deadline, next_action_at, closed_at, archived_at, salary_claim,
           contact_name, contact_info, notes, occupation_concept_id, occupation_label,
           occupation_group_label, working_hours_type, scope_of_work_min, scope_of_work_max,
           match_score, match_snapshot, match_version, match_scored_at, match_profile_id,
           report_excluded, report_note, reported_in_id, created_at, updated_at
    from core_jobapplication
  `);
  const events = await query<Record<string, unknown>>(`
    select id, application_id, occurred_at, note, status, event_type, from_stage, to_stage,
           origin, is_reportable, report_excluded, reported_in_id, created_at
    from core_applicationevent
  `);
  const searches = await query<Record<string, unknown>>(`
    select id, owner_id, label, q, regions, municipalities, occupation_fields, occupation_groups,
           remote, match_cv, digest_checked_at, created_at
    from core_savedjobsearch
  `);
  const resumes = await query<Record<string, unknown>>(`
    select user_id, headline, summary, skills, skill_groups, experience, education,
           job_profiles, updated_at
    from core_resume
  `);
  const periods = await query<Record<string, unknown>>(`
    select id, user_id, year, month, submitted_at, note
    from core_reportperiod
  `);
  const activities = await query<Record<string, unknown>>(`
    select id, user_id, type, occurred_on, title, organisation, note, job_id,
           report_excluded, report_note, reported_in_id
    from core_activity
  `);

  return {
    users: users.map((row) => ({
      id: numberField(row, 'id'),
      email: asString(row.email),
      firstName: asString(row.first_name),
      lastName: asString(row.last_name),
      isActive: boolField(row, 'is_active', true),
      dateJoined: asDate(row.date_joined),
      lastLogin: asDate(row.last_login),
    })),
    emails: emails.map((row) => ({
      userId: numberField(row, 'user_id'),
      email: asString(row.email),
      verified: boolField(row, 'verified'),
      primary: boolField(row, 'primary'),
    })),
    profiles: profiles.map((row) => ({
      userId: numberField(row, 'user_id'),
      operatorId: asString(row.operator_id),
      deletionWarnedAt: asDate(row.deletion_warned_at),
      weeklySummarySentAt: asDate(row.weekly_summary_sent_at),
    })),
    applications: applications.map((row) => ({
      id: numberField(row, 'id'),
      ownerId: numberField(row, 'owner_id'),
      company: asString(row.company),
      title: asString(row.title),
      location: asString(row.location),
      adUrl: asString(row.ad_url),
      applyUrl: asString(row.apply_url),
      adDescription: asString(row.ad_description),
      sourceJobId: asString(row.source_job_id),
      source: asString(row.source),
      status: asString(row.status),
      outcome: asString(row.outcome),
      intent: asString(row.intent) || 'active',
      applyBy: isoDate(row.apply_by),
      applyByIsAuto: boolField(row, 'apply_by_is_auto', true),
      appliedAt: isoDate(row.applied_at),
      deadline: isoDate(row.deadline),
      nextActionAt: isoDate(row.next_action_at),
      closedAt: asDate(row.closed_at),
      archivedAt: asDate(row.archived_at),
      salaryClaim: asString(row.salary_claim),
      contactName: asString(row.contact_name),
      contactInfo: asString(row.contact_info),
      notes: asString(row.notes),
      occupationConceptId: asString(row.occupation_concept_id),
      occupationLabel: asString(row.occupation_label),
      occupationGroupLabel: asString(row.occupation_group_label),
      workingHoursType: asString(row.working_hours_type),
      scopeOfWorkMin: optionalNumber(row, 'scope_of_work_min'),
      scopeOfWorkMax: optionalNumber(row, 'scope_of_work_max'),
      matchScore: optionalNumber(row, 'match_score'),
      matchSnapshot: row.match_snapshot,
      matchVersion: optionalNumber(row, 'match_version') ?? 0,
      matchScoredAt: asDate(row.match_scored_at),
      matchProfileId: asString(row.match_profile_id),
      reportExcluded: boolField(row, 'report_excluded'),
      reportNote: asString(row.report_note),
      reportedInId: optionalNumber(row, 'reported_in_id'),
      createdAt: asDate(row.created_at),
      updatedAt: asDate(row.updated_at),
    })),
    events: events.map((row) => ({
      id: numberField(row, 'id'),
      applicationId: numberField(row, 'application_id'),
      occurredAt: isoDate(row.occurred_at),
      note: asString(row.note),
      status: asString(row.status),
      eventType: asString(row.event_type),
      fromStage: asString(row.from_stage),
      toStage: asString(row.to_stage),
      isReportable: boolField(row, 'is_reportable'),
      reportExcluded: boolField(row, 'report_excluded'),
      reportedInId: optionalNumber(row, 'reported_in_id'),
      createdAt: asDate(row.created_at),
    })),
    searches: searches.map((row) => ({
      id: numberField(row, 'id'),
      ownerId: numberField(row, 'owner_id'),
      label: asString(row.label),
      query: asString(row.q),
      regions: row.regions,
      municipalities: row.municipalities,
      occupationFields: row.occupation_fields,
      occupationGroups: row.occupation_groups,
      remote: boolField(row, 'remote'),
      matchCv: boolField(row, 'match_cv'),
      digestCheckedAt: asDate(row.digest_checked_at),
      createdAt: asDate(row.created_at),
    })),
    resumes: resumes.map((row) => ({
      userId: numberField(row, 'user_id'),
      headline: asString(row.headline),
      summary: asString(row.summary),
      skills: row.skills,
      skillGroups: row.skill_groups,
      experience: row.experience,
      education: row.education,
      jobProfiles: row.job_profiles,
      updatedAt: asDate(row.updated_at),
    })),
    periods: periods.map((row) => ({
      id: numberField(row, 'id'),
      userId: numberField(row, 'user_id'),
      year: numberField(row, 'year'),
      month: numberField(row, 'month'),
      submittedAt: asDate(row.submitted_at),
      note: asString(row.note),
      // Django saknade created_at — använd submitted_at när det finns.
      createdAt: asDate(row.submitted_at),
    })),
    activities: activities.map((row) => ({
      id: numberField(row, 'id'),
      userId: numberField(row, 'user_id'),
      type: asString(row.type),
      occurredOn: isoDate(row.occurred_on),
      title: asString(row.title),
      organisation: asString(row.organisation),
      note: asString(row.note),
      jobId: optionalNumber(row, 'job_id'),
      reportExcluded: boolField(row, 'report_excluded'),
      reportNote: asString(row.report_note),
      reportedInId: optionalNumber(row, 'reported_in_id'),
    })),
  };
}

export function reportedInPatches(planned: PlannedImport): {
  applications: Array<{ id: string; reportedInId: string }>;
  events: Array<{ id: string; reportedInId: string }>;
  activities: Array<{ id: string; reportedInId: string }>;
} {
  const periodByDjangoId = new Map(
    planned.periods.map((period) => [period.djangoId, period.id]),
  );
  const resolve = (djangoId: number | null, id: string) => {
    if (djangoId == null) return [];
    const reportedInId = periodByDjangoId.get(djangoId);
    return reportedInId ? [{ id, reportedInId }] : [];
  };
  return {
    applications: planned.applications.flatMap((row) =>
      resolve(row.djangoReportedInId, row.id),
    ),
    events: planned.events.flatMap((row) => resolve(row.djangoReportedInId, row.id)),
    activities: planned.activities.flatMap((row) => resolve(row.djangoReportedInId, row.id)),
  };
}

type WritableDb = {
  insert: (table: object) => { values: (values: object[]) => PromiseLike<unknown> };
  update: (table: object) => {
    set: (values: object) => { where: (clause: object) => PromiseLike<unknown> };
  };
};

const CHUNK = 100;

async function insertChunk(db: WritableDb, table: object, rows: object[]): Promise<void> {
  for (let index = 0; index < rows.length; index += CHUNK) {
    const slice = rows.slice(index, index + CHUNK);
    if (slice.length === 0) continue;
    await db.insert(table).values(slice);
  }
}

/** Write a planned import. Aborts when the report contains errors. */
export async function applyImport(db: object, planned: PlannedImport): Promise<void> {
  if (planned.report.errors.length > 0) {
    throw new Error(`Import avbruten: ${planned.report.errors.join('; ')}`);
  }

  const writable = db as WritableDb;
  await insertChunk(writable, t.users, planned.users);
  await insertChunk(writable, t.accounts, planned.accounts);
  await insertChunk(
    writable,
    t.reportPeriods,
    planned.periods.map(({ djangoId: _djangoId, ...row }) => row),
  );
  await insertChunk(
    writable,
    t.applications,
    planned.applications.map(({ djangoReportedInId: _reported, ...row }) => row),
  );
  await insertChunk(
    writable,
    t.applicationEvents,
    planned.events.map(({ djangoReportedInId: _reported, ...row }) => row),
  );
  await insertChunk(writable, t.savedSearches, planned.searches);
  await insertChunk(writable, t.resumes, planned.resumes);
  await insertChunk(
    writable,
    t.activities,
    planned.activities.map(({ djangoReportedInId: _reported, ...row }) => row),
  );

  const patches = reportedInPatches(planned);
  for (const patch of patches.applications) {
    await writable
      .update(t.applications)
      .set({ reportedInId: patch.reportedInId })
      .where(eq(t.applications.id, patch.id));
  }
  for (const patch of patches.events) {
    await writable
      .update(t.applicationEvents)
      .set({ reportedInId: patch.reportedInId })
      .where(eq(t.applicationEvents.id, patch.id));
  }
  for (const patch of patches.activities) {
    await writable
      .update(t.activities)
      .set({ reportedInId: patch.reportedInId })
      .where(eq(t.activities.id, patch.id));
  }
}
