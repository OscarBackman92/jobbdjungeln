import 'server-only';
import {
  type MatchSnapshot,
  matchingTermsFromResume,
  normalizeAdUrl,
  scorePosting,
  trimSnapshot,
} from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import type { JobAd, SearchParams, SearchSort, SearchStatBucket } from '@jobbdjungeln/jobtech';
import { eq } from 'drizzle-orm';
import { compareCvMatch } from '@/components/jobs/match-badge-logic';
import { db } from '@/lib/db';
import { jobtech } from '@/lib/jobtech';
import { trackedAds } from '@/server/applications';

/**
 * Ad search, enriched for the signed-in user.
 *
 * Two things are layered onto the raw JobTech results: whether the user already
 * tracks the ad, and how well their CV covers its requirements. Both are done
 * here rather than in the client so a search is one round trip.
 */

const CV_SORT_POOL = 100;
const JOBTECH_PAGE = 50;

export interface SearchHit extends JobAd {
  alreadyTracked: boolean;
  /** Present when the ad is already on the board, so the card can unsaved. */
  trackedApplicationId: string | null;
  match: MatchSnapshot | null;
}

export interface SearchResponse {
  total: number;
  results: SearchHit[];
  /** Set when the CV is empty, so the UI can explain the missing scores. */
  hasResume: boolean;
  /** True when CV sort scored only the newest 100 of a larger result set. */
  cvSortCapped?: boolean;
  /** Facet buckets for the full result set (when requested). */
  stats?: SearchStatBucket[];
}

export type JobSearchParams = Omit<SearchParams, 'sort'> & {
  sort?: SearchSort | 'cv-match';
};

function enrichAds(
  ads: JobAd[],
  trackedByKey: Map<string, string>,
  skills: string[],
  withMatch: boolean,
  hasResume: boolean,
): SearchHit[] {
  return ads.map((ad) => {
    const trackedApplicationId = trackedByKey.get(normalizeAdUrl(ad.webpageUrl)) ?? null;
    return {
      ...ad,
      alreadyTracked: trackedApplicationId !== null,
      trackedApplicationId,
      match:
        withMatch && hasResume
          ? trimSnapshot(scorePosting(skills, { title: ad.title, description: ad.description }))
          : null,
    };
  });
}

async function fetchNewestPool(
  params: SearchParams,
): Promise<{ total: number; results: JobAd[] }> {
  const base = { ...params, sort: 'pubdate-desc' as const, limit: JOBTECH_PAGE };
  const first = await jobtech().search({ ...base, offset: 0 });
  if (first.total <= JOBTECH_PAGE || first.results.length < JOBTECH_PAGE) {
    return { total: first.total, results: first.results.slice(0, CV_SORT_POOL) };
  }
  const second = await jobtech().search({ ...base, offset: JOBTECH_PAGE });
  return {
    total: first.total,
    results: [...first.results, ...second.results].slice(0, CV_SORT_POOL),
  };
}

export async function searchJobs(
  userId: string,
  params: JobSearchParams,
  { withMatch = true }: { withMatch?: boolean } = {},
): Promise<SearchResponse> {
  // Count-only: JobTech `limit=0` returns total (and optional stats) without hits.
  if ((params.limit ?? 25) === 0) {
    const sort =
      params.sort === 'cv-match' ? 'pubdate-desc' : (params.sort as SearchSort | undefined);
    const result = await jobtech().search({ ...params, sort, limit: 0 });
    return {
      total: result.total,
      results: [],
      hasResume: true,
      stats: result.stats,
    };
  }

  const [tracked, resume] = await Promise.all([
    trackedAds(userId),
    db().query.resumes.findFirst({ where: eq(schema.resumes.userId, userId) }),
  ]);

  const trackedByKey = new Map(tracked.map((row) => [row.key, row.id]));
  const skills = resume ? matchingTermsFromResume(resume) : [];
  const hasResume = skills.length > 0;
  const cvSort = params.sort === 'cv-match';

  if (cvSort) {
    const { sort: _ignored, ...poolParams } = params;
    const pool = await fetchNewestPool(poolParams);
    const enriched = enrichAds(pool.results, trackedByKey, skills, withMatch, hasResume);
    enriched.sort(compareCvMatch);
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 25;
    const page = enriched.slice(offset, offset + limit);
    return {
      total: enriched.length,
      hasResume,
      results: page,
      cvSortCapped: pool.total > CV_SORT_POOL,
    };
  }

  const result = await jobtech().search({
    ...params,
    sort: params.sort as SearchSort | undefined,
  });

  return {
    total: result.total,
    hasResume,
    results: enrichAds(result.results, trackedByKey, skills, withMatch, hasResume),
  };
}

export async function listSavedSearches(userId: string) {
  return db()
    .select()
    .from(schema.savedSearches)
    .where(eq(schema.savedSearches.userId, userId))
    .orderBy(schema.savedSearches.createdAt);
}
