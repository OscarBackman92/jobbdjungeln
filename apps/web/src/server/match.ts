import 'server-only';
import {
  MATCH_VERSION,
  matchingTermsFromResume,
  postingLikeFromApplication,
  scorePosting,
  trimSnapshot,
} from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';

/** Score an ad against the owner's CV, or null when there is nothing to score. */
export async function scoreForUser(
  userId: string,
  posting: { title: string; adDescription?: string },
) {
  const resume = await db().query.resumes.findFirst({
    where: eq(schema.resumes.userId, userId),
  });
  if (!resume) return null;
  const skills = matchingTermsFromResume(resume);
  if (skills.length === 0) return null;
  const snapshot = trimSnapshot(scorePosting(skills, postingLikeFromApplication(posting)));
  return {
    matchScore: snapshot.score,
    matchSnapshot: snapshot,
    matchVersion: MATCH_VERSION,
    matchScoredAt: new Date(),
  };
}
