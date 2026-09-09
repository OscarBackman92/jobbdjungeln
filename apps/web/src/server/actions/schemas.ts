import {
  ACTIVITY_TYPES,
  APPLICATION_SOURCES,
  INTENTS,
  isIsoDate,
  STATUSES,
} from '@jobbdjungeln/core';
import { z } from 'zod';

/**
 * Input schemas.
 *
 * Server Actions are a public HTTP surface — anything reachable from the browser
 * is reachable from curl — so every field is validated here rather than trusted
 * because a form produced it.
 */

const trimmed = (max: number) => z.string().trim().max(max);

/** An optional calendar date. Empty string is how a cleared date field arrives. */
export const isoDate = z
  .union([z.literal(''), z.string()])
  .transform((value) => (value === '' ? null : value))
  .refine((value) => value === null || isIsoDate(value), 'Ange ett giltigt datum.')
  .nullable();

export const statusSchema = z.enum(STATUSES);
export const intentSchema = z.enum(INTENTS);
export const sourceSchema = z.enum(APPLICATION_SOURCES);
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);

export const createApplicationSchema = z.object({
  company: trimmed(255).min(1, 'Ange arbetsgivare.'),
  title: trimmed(255).min(1, 'Ange vilken roll det gäller.'),
  location: trimmed(255).default(''),
  status: statusSchema.default('applied'),
  source: sourceSchema.optional(),
  adUrl: z.union([z.literal(''), z.url('Ange en giltig länk.')]).default(''),
  applyUrl: z.union([z.literal(''), z.url('Ange en giltig länk.')]).default(''),
  adDescription: trimmed(20_000).default(''),
  sourceJobId: trimmed(32).default(''),
  appliedAt: isoDate.optional(),
  deadline: isoDate.optional(),
  applyBy: isoDate.optional(),
  nextActionAt: isoDate.optional(),
  salaryClaim: trimmed(80).default(''),
  contactName: trimmed(255).default(''),
  contactInfo: trimmed(255).default(''),
  notes: trimmed(10_000).default(''),
  occupationConceptId: trimmed(64).default(''),
  occupationLabel: trimmed(255).default(''),
  occupationGroupLabel: trimmed(255).default(''),
  workingHoursType: trimmed(64).default(''),
  scopeOfWorkMin: z.number().int().min(0).max(100).nullable().optional(),
  scopeOfWorkMax: z.number().int().min(0).max(100).nullable().optional(),
});

export const updateApplicationSchema = createApplicationSchema.partial().extend({
  id: z.string().min(1),
  intent: intentSchema.optional(),
});

export const changeStatusSchema = z.object({
  id: z.string().min(1),
  status: statusSchema,
  salaryClaim: trimmed(80).optional(),
  note: trimmed(500).optional(),
});

export const addEventSchema = z.object({
  applicationId: z.string().min(1),
  occurredAt: z.string().refine(isIsoDate, 'Ange ett giltigt datum.'),
  note: trimmed(500).min(1, 'Skriv vad som hände.'),
  eventType: z
    .enum(['anteckning', 'samtal', 'intervju', 'mejl', 'test', 'referens'])
    .default('anteckning'),
});

export const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'Välj minst en rad.').max(200),
  action: z.enum([
    'mark_applied',
    'archive',
    'unarchive',
    'pause',
    'activate',
    'set_apply_by',
    'delete',
  ]),
  applyBy: isoDate.optional(),
  salaryClaim: trimmed(80).optional(),
});

export const savedSearchSchema = z.object({
  id: z.string().optional(),
  label: trimmed(120).default(''),
  query: trimmed(255).default(''),
  regions: z.array(trimmed(64)).max(25).default([]),
  municipalities: z.array(trimmed(64)).max(50).default([]),
  occupationFields: z.array(trimmed(64)).max(25).default([]),
  occupationGroups: z.array(trimmed(64)).max(50).default([]),
  remote: z.boolean().default(false),
  matchCv: z.boolean().default(false),
  digestOptIn: z.boolean().default(true),
});

const resumeEntryId = z.string().max(64);

export const resumeSchema = z.object({
  headline: trimmed(255).default(''),
  summary: trimmed(4000).default(''),
  skills: z.array(trimmed(80)).max(200).default([]),
  experience: z
    .array(
      z.object({
        id: resumeEntryId,
        role: trimmed(255).default(''),
        employer: trimmed(255).default(''),
        start: trimmed(40).default(''),
        end: trimmed(40).default(''),
        description: trimmed(4000).default(''),
        skills: z.array(trimmed(80)).max(60).default([]),
      }),
    )
    .max(40)
    .default([]),
  education: z
    .array(
      z.object({
        id: resumeEntryId,
        program: trimmed(255).default(''),
        school: trimmed(255).default(''),
        start: trimmed(40).default(''),
        end: trimmed(40).default(''),
      }),
    )
    .max(40)
    .default([]),
  jobProfiles: z
    .array(
      z.object({
        id: resumeEntryId,
        label: trimmed(80).default(''),
        skills: z.array(trimmed(80)).max(100).default([]),
        confirmed: z.array(trimmed(80)).max(100).default([]),
      }),
    )
    .max(10)
    .default([]),
});

export const activitySchema = z.object({
  id: z.string().optional(),
  type: activityTypeSchema,
  occurredOn: z.string().refine(isIsoDate, 'Ange ett giltigt datum.'),
  title: trimmed(255).min(1, 'Ge aktiviteten ett namn.'),
  organisation: trimmed(255).default(''),
  note: trimmed(2000).default(''),
  applicationId: z.string().optional(),
});

export const periodKeySchema = z.string().regex(/^\d{4}-\d{2}$/, 'Ogiltig månad.');

export const profileSchema = z.object({
  name: trimmed(120).default(''),
  weeklySummaryOptIn: z.boolean().default(false),
  reminderOptIn: z.boolean().default(true),
});
