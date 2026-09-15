/**
 * Wire-format schemas for JobTech.
 *
 * The upstream API is third-party and evolves, so every response is parsed
 * defensively: unknown fields are ignored, missing ones fall back, and a hit
 * that cannot be understood at all is dropped rather than crashing a search.
 */

import { z } from 'zod';

const concept = z
  .object({
    concept_id: z.string().nullish(),
    label: z.string().nullish(),
    legacy_ams_taxonomy_id: z.string().nullish(),
  })
  .loose();

/** JobTech returns occupation concepts as objects, but sometimes as a 1-item list. */
const conceptish = z.union([concept, z.array(concept)]).nullish();

export const jobTechHitSchema = z
  .object({
    id: z.union([z.string(), z.number()]).nullish(),
    headline: z.string().nullish(),
    description: z
      .object({
        text: z.string().nullish(),
        text_formatted: z.string().nullish(),
      })
      .loose()
      .nullish(),
    employer: z.object({ name: z.string().nullish() }).loose().nullish(),
    workplace_address: z
      .object({ municipality: z.string().nullish(), city: z.string().nullish() })
      .loose()
      .nullish(),
    webpage_url: z.string().nullish(),
    application_details: z
      .object({
        url: z.string().nullish(),
        email: z.string().nullish(),
        via_af: z.boolean().nullish(),
      })
      .loose()
      .nullish(),
    publication_date: z.string().nullish(),
    application_deadline: z.string().nullish(),
    remote_work: z.boolean().nullish(),
    occupation: conceptish,
    occupation_group: conceptish,
    working_hours_type: conceptish,
    scope_of_work: z
      .object({ min: z.number().nullish(), max: z.number().nullish() })
      .loose()
      .nullish(),
  })
  .loose();

export type JobTechHit = z.infer<typeof jobTechHitSchema>;

export const jobTechStatValueSchema = z
  .object({
    term: z.string().nullish(),
    concept_id: z.string().nullish(),
    count: z.number().nullish(),
  })
  .loose();

export const jobTechStatBucketSchema = z
  .object({
    type: z.string().nullish(),
    values: z.array(z.unknown()).nullish(),
  })
  .loose();

export const jobTechSearchResponseSchema = z
  .object({
    total: z.object({ value: z.number().nullish() }).loose().nullish(),
    hits: z.array(z.unknown()).nullish(),
    stats: z.array(z.unknown()).nullish(),
  })
  .loose();

export const taxonomyConceptSchema = z
  .object({
    'taxonomy/id': z.string().nullish(),
    'taxonomy/preferred-label': z.string().nullish(),
    id: z.string().nullish(),
    label: z.string().nullish(),
  })
  .loose();

export const taxonomyResponseSchema = z.union([
  z.array(z.unknown()),
  z.object({ value: z.array(z.unknown()).nullish() }).loose(),
]);
