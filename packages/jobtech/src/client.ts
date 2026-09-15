/**
 * Client for Arbetsförmedlingen's open JobTech APIs.
 *
 * Every search hits JobTech live, so the ad list covers all of Platsbanken with
 * real filters and no local ad database. No API key is required.
 *
 * The client is a plain object with injectable `fetch` and base URLs, so tests
 * and the e2e suite can point it at a local mock without any global patching.
 */

import {
  jobTechHitSchema,
  jobTechSearchResponseSchema,
  taxonomyConceptSchema,
  taxonomyResponseSchema,
} from './schemas.ts';
import { expandSwedishQuery } from './swedish.ts';
import {
  type Municipality,
  type OccupationGroup,
  type TaxonomyOption,
  validConceptIds,
  validFieldIds,
  validRegionIds,
} from './taxonomy.ts';

export const MAX_LIMIT = 50;
const DEFAULT_TIMEOUT_MS = 15_000;
const URL_MAX_LENGTH = 500;

export interface JobAd {
  id: string;
  title: string;
  companyName: string;
  location: string;
  description: string;
  /** HTML body from JobTech `description.text_formatted`, when present. */
  descriptionHtml: string;
  /** The Platsbanken ad page. */
  webpageUrl: string;
  /** The employer's own apply URL, when the ad is not handled via AF. */
  applicationUrl: string;
  publishedAt: string | null;
  applicationDeadline: string | null;
  remote: boolean;
  occupationConceptId: string;
  occupationLabel: string;
  occupationGroupLabel: string;
  workingHoursType: string;
  scopeOfWorkMin: number | null;
  scopeOfWorkMax: number | null;
}

/** Sort options supported by JobTech search. */
export const SEARCH_SORTS = [
  'pubdate-desc',
  'relevance',
  'applydate-asc',
  'applydate-desc',
] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export interface SearchParams {
  q?: string;
  regions?: readonly string[];
  municipalities?: readonly string[];
  fields?: readonly string[];
  groups?: readonly string[];
  remote?: boolean;
  /** JobTech sort — defaults to newest first. */
  sort?: SearchSort;
  /**
   * Ads published after this point. ISO datetime (`YYYY-mm-ddTHH:MM:SS`) or
   * minutes as a number string (e.g. `"10080"` = last 7 days).
   */
  publishedAfter?: string;
  /** Pass `false` to keep only ads that do not require experience. */
  experience?: boolean;
  /** Employment-type taxonomy concept ids. */
  employmentType?: readonly string[];
  offset?: number;
  limit?: number;
}

export interface SearchResult {
  total: number;
  results: JobAd[];
}

/** Thrown when JobTech is unreachable or answers with an error. */
export class JobTechError extends Error {
  readonly status: number | undefined;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'JobTechError';
    this.status = options.status;
  }
}

export interface JobTechClientOptions {
  searchUrl?: string;
  adUrl?: string;
  historicalAdUrl?: string;
  taxonomyConceptsUrl?: string;
  taxonomyAutocompleteUrl?: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

const DEFAULTS = {
  searchUrl: 'https://jobsearch.api.jobtechdev.se/search',
  adUrl: 'https://jobsearch.api.jobtechdev.se/ad',
  historicalAdUrl: 'https://historical.api.jobtechdev.se/ad',
  taxonomyConceptsUrl: 'https://taxonomy.api.jobtechdev.se/v1/taxonomy/main/concepts',
  taxonomyAutocompleteUrl:
    'https://taxonomy.api.jobtechdev.se/v1/taxonomy/suggesters/autocomplete',
} as const;

function firstConcept(value: unknown): { conceptId: string; label: string } {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== 'object') return { conceptId: '', label: '' };
  const record = raw as Record<string, unknown>;
  return {
    conceptId: typeof record.concept_id === 'string' ? record.concept_id : '',
    label: typeof record.label === 'string' ? record.label : '',
  };
}

function isoDay(value: string | null | undefined): string | null {
  const day = (value ?? '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function boundedInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
}

/** The employer's own apply link, when the ad is not handled through AF. */
function applicationUrl(hit: { application_details?: unknown }): string {
  const details = hit.application_details;
  if (!details || typeof details !== 'object') return '';
  const record = details as Record<string, unknown>;
  if (record.via_af === true) return '';

  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (url) return url.slice(0, URL_MAX_LENGTH);

  const email = typeof record.email === 'string' ? record.email.trim() : '';
  if (email.includes('@')) return `mailto:${email}`.slice(0, URL_MAX_LENGTH);
  return '';
}

/** Map one JobTech hit onto the shape the app stores and renders. */
export function hitToJobAd(raw: unknown): JobAd | null {
  const parsed = jobTechHitSchema.safeParse(raw);
  if (!parsed.success) return null;
  const hit = parsed.data;

  const id = hit.id == null ? '' : String(hit.id);
  if (!id) return null;

  const occupation = firstConcept(hit.occupation);
  const group = firstConcept(hit.occupation_group);
  const hours = firstConcept(hit.working_hours_type);
  const address = hit.workplace_address ?? {};

  return {
    id,
    title: hit.headline ?? '',
    companyName: hit.employer?.name ?? '',
    location: address.municipality ?? address.city ?? '',
    description: hit.description?.text ?? '',
    descriptionHtml: hit.description?.text_formatted ?? '',
    webpageUrl: (hit.webpage_url ?? '').slice(0, URL_MAX_LENGTH),
    applicationUrl: applicationUrl(hit),
    publishedAt: isoDay(hit.publication_date),
    applicationDeadline: isoDay(hit.application_deadline),
    remote: hit.remote_work === true,
    occupationConceptId: occupation.conceptId,
    occupationLabel: occupation.label,
    occupationGroupLabel: group.label,
    workingHoursType: hours.label,
    scopeOfWorkMin: boundedInt(hit.scope_of_work?.min),
    scopeOfWorkMax: boundedInt(hit.scope_of_work?.max),
  };
}

export function createJobTechClient(options: JobTechClientOptions = {}) {
  const config = { ...DEFAULTS, ...options };
  const doFetch = options.fetch ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function getJson(url: string): Promise<unknown> {
    const signal = AbortSignal.timeout(timeoutMs);
    let response: Response;
    try {
      response = await doFetch(url, { signal, headers: { accept: 'application/json' } });
    } catch (cause) {
      const timedOut = cause instanceof Error && cause.name === 'TimeoutError';
      throw new JobTechError(
        timedOut ? 'JobTech svarade inte i tid.' : 'Kunde inte nå JobTech.',
        { cause },
      );
    }
    if (!response.ok) {
      throw new JobTechError(`JobTech svarade ${response.status}.`, {
        status: response.status,
      });
    }
    try {
      return await response.json();
    } catch (cause) {
      throw new JobTechError('JobTech svarade med något som inte är JSON.', { cause });
    }
  }

  function conceptList(payload: unknown): Array<{ id: string; label: string }> {
    const parsed = taxonomyResponseSchema.safeParse(payload);
    if (!parsed.success) return [];
    const raw = Array.isArray(parsed.data) ? parsed.data : (parsed.data.value ?? []);

    const out: Array<{ id: string; label: string }> = [];
    const seen = new Set<string>();
    for (const item of raw) {
      const concept = taxonomyConceptSchema.safeParse(item);
      if (!concept.success) continue;
      const id = concept.data['taxonomy/id'] ?? concept.data.id ?? '';
      const label = concept.data['taxonomy/preferred-label'] ?? concept.data.label ?? '';
      if (!id || !label || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, label });
    }
    out.sort((a, b) => a.label.localeCompare(b.label, 'sv'));
    return out;
  }

  return {
    /** Search all of Platsbanken. Unknown filter ids are dropped, not rejected. */
    async search(params: SearchParams = {}): Promise<SearchResult> {
      const query = new URLSearchParams();
      query.set('offset', String(Math.max(0, params.offset ?? 0)));
      // JobTech accepts limit 0–50; 0 returns only `total` (no hits).
      query.set('limit', String(Math.min(Math.max(0, params.limit ?? 25), MAX_LIMIT)));
      const sort = SEARCH_SORTS.includes(params.sort as SearchSort)
        ? (params.sort as SearchSort)
        : 'pubdate-desc';
      query.set('sort', sort);

      const q = (params.q ?? '').trim();
      if (q) query.set('q', expandSwedishQuery(q));

      // The narrower filter wins: picking municipalities makes the region moot.
      const municipalities = validConceptIds(params.municipalities ?? []);
      const regions = validRegionIds(params.regions ?? []);
      for (const id of municipalities.length ? municipalities : []) {
        query.append('municipality', id);
      }
      if (!municipalities.length) {
        for (const id of regions) query.append('region', id);
      }

      const groups = validConceptIds(params.groups ?? []);
      const fields = validFieldIds(params.fields ?? []);
      for (const id of groups.length ? groups : []) query.append('occupation-group', id);
      if (!groups.length) {
        for (const id of fields) query.append('occupation-field', id);
      }

      if (params.remote) query.set('remote', 'true');

      const publishedAfter = (params.publishedAfter ?? '').trim();
      if (publishedAfter) query.set('published-after', publishedAfter);

      if (params.experience === false) query.set('experience', 'false');

      for (const id of validConceptIds(params.employmentType ?? [])) {
        query.append('employment-type', id);
      }

      const payload = await getJson(`${config.searchUrl}?${query}`);
      const parsed = jobTechSearchResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new JobTechError('JobTech svarade i ett format vi inte känner igen.');
      }

      return {
        total: parsed.data.total?.value ?? 0,
        results: (parsed.data.hits ?? [])
          .map(hitToJobAd)
          .filter((ad): ad is JobAd => ad !== null),
      };
    },

    /** One live ad by its JobTech id. */
    async fetchAd(jobId: string): Promise<JobAd> {
      const id = String(jobId ?? '').trim();
      if (!/^\d+$/.test(id)) throw new JobTechError('Ogiltigt annons-id.');
      const ad = hitToJobAd(await getJson(`${config.adUrl}/${id}`));
      if (!ad) throw new JobTechError('Annonsen gick inte att tolka.');
      return ad;
    },

    /**
     * An ad that may already have expired. Returns null when it is gone for
     * good, which is a normal outcome rather than an error.
     */
    async fetchHistoricalAd(jobId: string): Promise<JobAd | null> {
      const id = String(jobId ?? '').trim();
      if (!/^\d+$/.test(id)) throw new JobTechError('Ogiltigt annons-id.');
      try {
        return hitToJobAd(await getJson(`${config.historicalAdUrl}/${id}`));
      } catch (error) {
        if (error instanceof JobTechError && error.status === 404) return null;
        throw error;
      }
    },

    /** Municipalities inside one region, for the second-level location filter. */
    async municipalities(regionId: string): Promise<Municipality[]> {
      if (validRegionIds([regionId]).length === 0) return [];
      const query = new URLSearchParams({
        type: 'municipality',
        relation: 'narrower',
        'related-ids': regionId,
      });
      const concepts = conceptList(await getJson(`${config.taxonomyConceptsUrl}?${query}`));
      return concepts.map((concept) => ({ ...concept, regionId }));
    },

    /** Occupation groups inside one field, for the second-level role filter. */
    async occupationGroups(fieldId: string): Promise<OccupationGroup[]> {
      if (validFieldIds([fieldId]).length === 0) return [];
      const query = new URLSearchParams({
        type: 'ssyk-level-4',
        relation: 'narrower',
        'related-ids': fieldId,
      });
      const concepts = conceptList(await getJson(`${config.taxonomyConceptsUrl}?${query}`));
      return concepts.map((concept) => ({ ...concept, fieldId }));
    },

    /**
     * Occupation-name autocomplete. The monthly AF report asks for the same
     * concept type that ads already carry, so the two always line up.
     */
    async suggestOccupations(query: string, limit = 8): Promise<TaxonomyOption[]> {
      const text = query.trim();
      if (text.length < 2) return [];
      const search = new URLSearchParams({ 'query-string': text, type: 'occupation-name' });
      const concepts = conceptList(
        await getJson(`${config.taxonomyAutocompleteUrl}?${search}`),
      );
      return concepts.slice(0, limit);
    },
  };
}

export type JobTechClient = ReturnType<typeof createJobTechClient>;
