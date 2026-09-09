import 'server-only';
import {
  type MatchSnapshot,
  normalizeAdUrl,
  scorePosting,
  trimSnapshot,
} from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import type { JobAd, SearchParams } from '@jobbdjungeln/jobtech';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { jobtech } from '@/lib/jobtech';
import { trackedAdUrls } from '@/server/applications';

/**
 * Ad search, enriched for the signed-in user.
 *
 * Two things are layered onto the raw JobTech results: whether the user already
 * tracks the ad, and how well their CV covers its requirements. Both are done
 * here rather than in the client so a search is one round trip.
 */

export interface SearchHit extends JobAd {
  alreadyTracked: boolean;
  match: MatchSnapshot | null;
}

export interface SearchResponse {
  total: number;
  results: SearchHit[];
  /** Set when the CV is empty, so the UI can explain the missing scores. */
  hasResume: boolean;
}

export async function searchJobs(
  userId: string,
  params: SearchParams,
  { withMatch = true }: { withMatch?: boolean } = {},
): Promise<SearchResponse> {
  const [result, tracked, resume] = await Promise.all([
    jobtech().search(params),
    trackedAdUrls(userId),
    db().query.resumes.findFirst({ where: eq(schema.resumes.userId, userId) }),
  ]);

  const trackedKeys = new Set(tracked);
  const skills = resume?.skills ?? [];
  const hasResume = skills.length > 0;

  return {
    total: result.total,
    hasResume,
    results: result.results.map((ad) => ({
      ...ad,
      alreadyTracked: trackedKeys.has(normalizeAdUrl(ad.webpageUrl)),
      match:
        withMatch && hasResume
          ? trimSnapshot(scorePosting(skills, { title: ad.title, description: ad.description }))
          : null,
    })),
  };
}

export async function listSavedSearches(userId: string) {
  return db()
    .select()
    .from(schema.savedSearches)
    .where(eq(schema.savedSearches.userId, userId))
    .orderBy(schema.savedSearches.createdAt);
}
