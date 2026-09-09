import 'server-only';
import { createJobTechClient } from '@jobbdjungeln/jobtech';
import { env } from './env';

/**
 * The JobTech client.
 *
 * The URLs are overridable so the end-to-end suite can point the whole app at a
 * local mock, without the app knowing it is being tested.
 */
let cached: ReturnType<typeof createJobTechClient> | undefined;

export function jobtech() {
  if (!cached) {
    const config = env();
    cached = createJobTechClient({
      ...(config.JOBTECH_SEARCH_URL ? { searchUrl: config.JOBTECH_SEARCH_URL } : {}),
      ...(config.JOBTECH_AD_URL ? { adUrl: config.JOBTECH_AD_URL } : {}),
      ...(config.JOBTECH_TAXONOMY_URL
        ? { taxonomyConceptsUrl: config.JOBTECH_TAXONOMY_URL }
        : {}),
    });
  }
  return cached;
}
