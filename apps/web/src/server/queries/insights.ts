import 'server-only';
import { buildSkillInsights, matchingTermsFromResume } from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';

export async function skillInsights(userId: string) {
  const [resume, rows] = await Promise.all([
    db().query.resumes.findFirst({ where: eq(schema.resumes.userId, userId) }),
    db()
      .select({
        status: schema.applications.status,
        archivedAt: schema.applications.archivedAt,
        matchScore: schema.applications.matchScore,
        matchScoredAt: schema.applications.matchScoredAt,
        matchSnapshot: schema.applications.matchSnapshot,
      })
      .from(schema.applications)
      .where(eq(schema.applications.userId, userId)),
  ]);

  return buildSkillInsights(
    rows.map((row) => ({
      status: row.status,
      archived: row.archivedAt !== null,
      matchScore: row.matchScore,
      matchScoredAt: row.matchScoredAt?.toISOString() ?? null,
      matchSnapshot:
        (row.matchSnapshot as {
          mustTotal?: number;
          meritTotal?: number;
          gaps?: Array<{ term?: string; level?: string }>;
          covered?: Array<{ term?: string }>;
          unusedCvTerms?: string[];
        } | null) ?? null,
    })),
    matchingTermsFromResume({
      skills: resume?.skills ?? [],
      jobProfiles: resume?.jobProfiles ?? [],
    }),
  );
}
