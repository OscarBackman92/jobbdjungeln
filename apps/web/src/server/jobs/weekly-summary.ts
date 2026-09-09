import 'server-only';
import { addDays, type IsoDate, today as todayIso } from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { jobtech } from '@/lib/jobtech';
import { sendMail } from '@/lib/mail/send';
import { weeklySummary } from '@/lib/mail/templates';

/**
 * The Monday summary.
 *
 * Idempotent within a week: the send is stamped on the user, so a retried cron
 * run — or two overlapping ones — cannot send the same digest twice.
 */

const WEEK_DAYS = 7;
const SOON_DAYS = 7;
const MAX_HITS_PER_SEARCH = 5;
const MAX_HITS_TOTAL = 8;

async function newHitsFor(
  userId: string,
): Promise<Array<{ title: string; company: string; url: string }>> {
  const searches = await db()
    .select()
    .from(schema.savedSearches)
    .where(
      and(eq(schema.savedSearches.userId, userId), eq(schema.savedSearches.digestOptIn, true)),
    );

  const hits: Array<{ title: string; company: string; url: string }> = [];

  for (const search of searches) {
    if (hits.length >= MAX_HITS_TOTAL) break;
    try {
      const result = await jobtech().search({
        q: search.query,
        regions: search.regions,
        municipalities: search.municipalities,
        fields: search.occupationFields,
        groups: search.occupationGroups,
        remote: search.remote,
        limit: MAX_HITS_PER_SEARCH * 2,
      });

      const seen = await db()
        .select({ adId: schema.digestSeenAds.adId })
        .from(schema.digestSeenAds)
        .where(eq(schema.digestSeenAds.savedSearchId, search.id));
      const seenIds = new Set(seen.map((row) => row.adId));

      const fresh = result.results
        .filter((ad) => !seenIds.has(ad.id))
        .slice(0, MAX_HITS_PER_SEARCH);
      if (fresh.length > 0) {
        await db()
          .insert(schema.digestSeenAds)
          .values(fresh.map((ad) => ({ savedSearchId: search.id, adId: ad.id })))
          .onConflictDoNothing();
      }

      for (const ad of fresh) {
        if (hits.length >= MAX_HITS_TOTAL) break;
        hits.push({ title: ad.title, company: ad.companyName, url: ad.webpageUrl });
      }

      await db()
        .update(schema.savedSearches)
        .set({ digestCheckedAt: new Date() })
        .where(eq(schema.savedSearches.id, search.id));
    } catch (error) {
      // One unreachable search must not cost the user the rest of their digest.
      console.error('[veckobrev] sökning misslyckades', { searchId: search.id, error });
    }
  }

  return hits;
}

export async function sendWeeklySummaries(today: IsoDate = todayIso()): Promise<{
  considered: number;
  sent: number;
}> {
  const weekAgo = addDays(today, -WEEK_DAYS);
  const soon = addDays(today, SOON_DAYS);
  const cutoff = new Date(Date.now() - WEEK_DAYS * 24 * 60 * 60 * 1000);

  const users = await db()
    .select({ id: schema.users.id, email: schema.users.email })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.weeklySummaryOptIn, true),
        eq(schema.users.emailVerified, true),
        sql`(${schema.users.weeklySummarySentAt} is null or ${schema.users.weeklySummarySentAt} < ${cutoff})`,
      ),
    );

  let sent = 0;

  for (const user of users) {
    const [counts] = await db()
      .select({
        applied: sql<number>`count(*) filter (where ${schema.applications.appliedAt} >= ${weekAgo})::int`,
        waiting: sql<number>`count(*) filter (where ${schema.applications.stage} = 'sokt')::int`,
        inDialog: sql<number>`count(*) filter (where ${schema.applications.stage} in ('kontakt','intervju','erbjudande'))::int`,
        savedDueSoon: sql<number>`count(*) filter (where ${schema.applications.stage} = 'bevakad' and ${schema.applications.applyBy} <= ${soon})::int`,
      })
      .from(schema.applications)
      .where(
        and(eq(schema.applications.userId, user.id), isNull(schema.applications.archivedAt)),
      );

    const newHits = await newHitsFor(user.id);
    const nothingToSay =
      (counts?.applied ?? 0) === 0 &&
      (counts?.inDialog ?? 0) === 0 &&
      (counts?.savedDueSoon ?? 0) === 0 &&
      newHits.length === 0;

    // Stamp regardless, so a user with nothing to report is not reconsidered
    // every hour for the rest of the week.
    await db()
      .update(schema.users)
      .set({ weeklySummarySentAt: new Date() })
      .where(eq(schema.users.id, user.id));

    if (nothingToSay) continue;

    const result = await sendMail(
      weeklySummary(
        user.email,
        {
          applied: counts?.applied ?? 0,
          waiting: counts?.waiting ?? 0,
          inDialog: counts?.inDialog ?? 0,
          savedDueSoon: counts?.savedDueSoon ?? 0,
          newHits,
        },
        env().APP_URL,
      ),
    );
    if (result.delivered) sent += 1;
  }

  return { considered: users.length, sent };
}

export { gte, lte };
