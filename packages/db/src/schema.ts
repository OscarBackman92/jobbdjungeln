/**
 * Database schema.
 *
 * Conventions:
 *   - primary keys are UUID v7 text ids, generated in the database, so rows
 *     sort by creation time without leaking a guessable sequence;
 *   - calendar dates (deadlines, "applied on") are `date` columns and travel as
 *     `YYYY-MM-DD` strings — never `Date` — so no timezone can shift them;
 *   - instants (created/updated) are `timestamptz`;
 *   - everything a user owns cascades on delete, which is what makes the GDPR
 *     erasure a single `delete from users`.
 */

import {
  ACTIVITY_TYPES,
  APPLICATION_SOURCES,
  INTENTS,
  OUTCOMES,
  STAGES,
  STATUSES,
} from '@jobbdjungeln/core';
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

/** `uuidv7()` is not built in; `gen_random_uuid()` ships with pgcrypto/PG13+. */
const id = () => text().primaryKey().default(sql`gen_random_uuid()`);

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const statusEnum = pgEnum('status', STATUSES);
export const stageEnum = pgEnum('stage', STAGES);
export const outcomeEnum = pgEnum('outcome', OUTCOMES);
export const intentEnum = pgEnum('intent', INTENTS);
export const applicationSourceEnum = pgEnum('application_source', APPLICATION_SOURCES);
export const activityTypeEnum = pgEnum('activity_type', ACTIVITY_TYPES);
export const eventOriginEnum = pgEnum('event_origin', ['manual', 'auto', 'import']);

/* ------------------------------------------------------------------ *
 * Auth — the shape better-auth expects, owned by us so it can migrate  *
 * with the rest of the schema.                                        *
 * ------------------------------------------------------------------ */

export const users = pgTable(
  'users',
  {
    id: id(),
    name: text().notNull().default(''),
    email: text().notNull(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),

    /** Short, human-quotable id shown in the UI and in support e-mails. */
    operatorId: varchar({ length: 16 }).notNull(),
    /** Set when the inactivity warning was sent; cleared by any sign-in. */
    deletionWarnedAt: timestamp({ withTimezone: true }),
    /** Idempotency guard for the Monday digest. */
    weeklySummarySentAt: timestamp({ withTimezone: true }),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    weeklySummaryOptIn: boolean().notNull().default(false),
    reminderOptIn: boolean().notNull().default(true),
  },
  (table) => [
    uniqueIndex('users_email_key').on(sql`lower(${table.email})`),
    uniqueIndex('users_operator_id_key').on(table.operatorId),
    index('users_last_seen_idx').on(table.lastSeenAt),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    token: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('sessions_token_key').on(table.token),
    index('sessions_user_idx').on(table.userId),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: id(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('accounts_provider_account_key').on(table.providerId, table.accountId),
    index('accounts_user_idx').on(table.userId),
  ],
);

export const verifications = pgTable(
  'verifications',
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('verifications_identifier_idx').on(table.identifier)],
);

/* ------------------------------------------------------------------ *
 * The tracker                                                         *
 * ------------------------------------------------------------------ */

export const applications = pgTable(
  'applications',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    company: text().notNull(),
    title: text().notNull(),
    location: text().notNull().default(''),

    /** Where the ad lives, and where to apply if the employer took over. */
    adUrl: text().notNull().default(''),
    /** Normalised form of `adUrl`, used to spot an ad already being tracked. */
    adUrlKey: text().notNull().default(''),
    applyUrl: text().notNull().default(''),
    /** Snapshot of the ad text, so the row survives the ad being taken down. */
    adDescription: text().notNull().default(''),
    sourceJobId: text().notNull().default(''),
    source: applicationSourceEnum(),

    status: statusEnum().notNull().default('applied'),
    /** Derived from `status` on write; stored so the database can filter on it. */
    stage: stageEnum().notNull().default('sokt'),
    outcome: outcomeEnum(),
    /** Furthest stage this row ever reached — what the funnel is built from. */
    furthestStage: stageEnum().notNull().default('sokt'),
    /** Normalised company name, for duplicate detection. */
    employerKey: text().notNull().default(''),

    occupationConceptId: text().notNull().default(''),
    occupationLabel: text().notNull().default(''),
    occupationGroupLabel: text().notNull().default(''),
    workingHoursType: text().notNull().default(''),
    scopeOfWorkMin: smallint(),
    scopeOfWorkMax: smallint(),

    intent: intentEnum().notNull().default('active'),
    /** "Sök senast" — from the ad deadline, or a two-week nudge. */
    applyBy: date(),
    applyByIsAuto: boolean().notNull().default(true),
    appliedAt: date(),
    deadline: date(),
    nextActionAt: date(),
    /** Date of the most recent timeline entry; drives the waiting-time lanes. */
    lastActivityAt: date(),
    closedAt: timestamp({ withTimezone: true }),
    archivedAt: timestamp({ withTimezone: true }),

    salaryClaim: varchar({ length: 80 }).notNull().default(''),
    contactName: text().notNull().default(''),
    contactInfo: text().notNull().default(''),
    notes: text().notNull().default(''),

    matchScore: smallint(),
    matchSnapshot: jsonb(),
    matchVersion: smallint().notNull().default(0),
    matchScoredAt: timestamp({ withTimezone: true }),

    reportExcluded: boolean().notNull().default(false),
    reportNote: text().notNull().default(''),
    reportedInId: text().references(() => reportPeriods.id, { onDelete: 'set null' }),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    // The board queries: one user's rows, by stage, newest first.
    index('applications_user_stage_idx').on(table.userId, table.stage, table.appliedAt),
    index('applications_user_archived_idx').on(table.userId, table.archivedAt),
    index('applications_user_apply_by_idx').on(table.userId, table.applyBy),
    index('applications_user_next_action_idx').on(table.userId, table.nextActionAt),
    index('applications_employer_idx').on(table.userId, table.employerKey),
    index('applications_reported_in_idx').on(table.reportedInId),
    // One user cannot track the same ad twice. Rows without an ad URL are
    // free text and exempt.
    uniqueIndex('applications_user_ad_url_key')
      .on(table.userId, table.adUrlKey)
      .where(sql`${table.adUrlKey} <> ''`),
  ],
);

export const applicationEvents = pgTable(
  'application_events',
  {
    id: id(),
    applicationId: text()
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    occurredAt: date().notNull(),
    note: varchar({ length: 500 }).notNull(),
    /** The status this event moved the row to, when it was a status change. */
    status: statusEnum(),
    fromStage: stageEnum(),
    toStage: stageEnum(),
    eventType: text().notNull().default(''),
    origin: eventOriginEnum().notNull().default('manual'),
    /** Interviews and the like belong in the monthly report; notes do not. */
    isReportable: boolean().notNull().default(false),
    reportExcluded: boolean().notNull().default(false),
    reportedInId: text().references(() => reportPeriods.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (table) => [
    index('application_events_application_idx').on(table.applicationId, table.occurredAt),
    index('application_events_reported_in_idx').on(table.reportedInId),
  ],
);

/* ------------------------------------------------------------------ *
 * CV                                                                  *
 * ------------------------------------------------------------------ */

export const resumes = pgTable('resumes', {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  headline: text().notNull().default(''),
  summary: text().notNull().default(''),
  /** Canonical skill labels. */
  skills: jsonb().$type<string[]>().notNull().default([]),
  experience: jsonb().$type<ResumeExperience[]>().notNull().default([]),
  education: jsonb().$type<ResumeEducation[]>().notNull().default([]),
  /** Named selections from the flat skill list — "Ekonomi", "IT-support". */
  jobProfiles: jsonb().$type<JobProfile[]>().notNull().default([]),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export interface ResumeExperience {
  id: string;
  role: string;
  employer: string;
  start: string;
  end: string;
  description: string;
  skills: string[];
}

export interface ResumeEducation {
  id: string;
  program: string;
  school: string;
  start: string;
  end: string;
}

export interface JobProfile {
  id: string;
  label: string;
  /** Selected skills from the flat CV list. */
  skills: string[];
  /** Skills the user can back up; defaults to the full selection. */
  confirmed: string[];
}

/* ------------------------------------------------------------------ *
 * Saved searches                                                      *
 * ------------------------------------------------------------------ */

export const savedSearches = pgTable(
  'saved_searches',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: varchar({ length: 120 }).notNull().default(''),
    query: text().notNull().default(''),
    regions: jsonb().$type<string[]>().notNull().default([]),
    municipalities: jsonb().$type<string[]>().notNull().default([]),
    occupationFields: jsonb().$type<string[]>().notNull().default([]),
    occupationGroups: jsonb().$type<string[]>().notNull().default([]),
    remote: boolean().notNull().default(false),
    matchCv: boolean().notNull().default(false),
    /** Digest e-mails report hits newer than this. */
    digestCheckedAt: timestamp({ withTimezone: true }),
    /** Last time the user ran this search in the UI — drives the "N nya" badge. */
    lastRunAt: timestamp({ withTimezone: true }),
    digestOptIn: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('saved_searches_user_idx').on(table.userId, table.createdAt)],
);

/* ------------------------------------------------------------------ *
 * Monthly reporting                                                   *
 * ------------------------------------------------------------------ */

export const reportPeriods = pgTable(
  'report_periods',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    year: smallint().notNull(),
    month: smallint().notNull(),
    /** Set when the user marks the month as handed in. Status is derived. */
    submittedAt: timestamp({ withTimezone: true }),
    note: text().notNull().default(''),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex('report_periods_user_month_key').on(table.userId, table.year, table.month),
  ],
);

export const activities = pgTable(
  'activities',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: activityTypeEnum().notNull(),
    occurredOn: date().notNull(),
    title: text().notNull(),
    organisation: text().notNull().default(''),
    note: text().notNull().default(''),
    applicationId: text().references(() => applications.id, { onDelete: 'set null' }),
    reportExcluded: boolean().notNull().default(false),
    reportNote: text().notNull().default(''),
    reportedInId: text().references(() => reportPeriods.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('activities_user_date_idx').on(table.userId, table.occurredOn),
    index('activities_reported_in_idx').on(table.reportedInId),
  ],
);

/* ------------------------------------------------------------------ *
 * Job ad cache — a shared, user-agnostic cache in front of JobTech.    *
 * ------------------------------------------------------------------ */

export const cachedAds = pgTable(
  'cached_ads',
  {
    id: text().primaryKey(),
    payload: jsonb().notNull(),
    fetchedAt: createdAt(),
  },
  (table) => [index('cached_ads_fetched_idx').on(table.fetchedAt)],
);

/** Hits already reported in a digest, so the same ad is never sent twice. */
export const digestSeenAds = pgTable(
  'digest_seen_ads',
  {
    savedSearchId: text()
      .notNull()
      .references(() => savedSearches.id, { onDelete: 'cascade' }),
    adId: text().notNull(),
    seenAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.savedSearchId, table.adId] }),
    index('digest_seen_ads_seen_idx').on(table.seenAt),
  ],
);

/* ------------------------------------------------------------------ *
 * Relations                                                           *
 * ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ many, one }) => ({
  applications: many(applications),
  savedSearches: many(savedSearches),
  reportPeriods: many(reportPeriods),
  activities: many(activities),
  sessions: many(sessions),
  accounts: many(accounts),
  resume: one(resumes, { fields: [users.id], references: [resumes.userId] }),
}));

export const applicationsRelations = relations(applications, ({ many, one }) => ({
  user: one(users, { fields: [applications.userId], references: [users.id] }),
  events: many(applicationEvents),
  activities: many(activities),
  reportedIn: one(reportPeriods, {
    fields: [applications.reportedInId],
    references: [reportPeriods.id],
  }),
}));

export const applicationEventsRelations = relations(applicationEvents, ({ one }) => ({
  application: one(applications, {
    fields: [applicationEvents.applicationId],
    references: [applications.id],
  }),
}));

export const reportPeriodsRelations = relations(reportPeriods, ({ many, one }) => ({
  user: one(users, { fields: [reportPeriods.userId], references: [users.id] }),
  applications: many(applications),
  activities: many(activities),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  user: one(users, { fields: [activities.userId], references: [users.id] }),
  application: one(applications, {
    fields: [activities.applicationId],
    references: [applications.id],
  }),
}));

export const savedSearchesRelations = relations(savedSearches, ({ one, many }) => ({
  user: one(users, { fields: [savedSearches.userId], references: [users.id] }),
  seenAds: many(digestSeenAds),
}));

export const digestSeenAdsRelations = relations(digestSeenAds, ({ one }) => ({
  savedSearch: one(savedSearches, {
    fields: [digestSeenAds.savedSearchId],
    references: [savedSearches.id],
  }),
}));

/* ------------------------------------------------------------------ *
 * Inferred row types                                                  *
 * ------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
export type ApplicationEvent = typeof applicationEvents.$inferSelect;
export type NewApplicationEvent = typeof applicationEvents.$inferInsert;
export type Resume = typeof resumes.$inferSelect;
export type SavedSearch = typeof savedSearches.$inferSelect;
export type ReportPeriod = typeof reportPeriods.$inferSelect;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
