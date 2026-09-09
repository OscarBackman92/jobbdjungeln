import 'server-only';
import { schema } from '@jobbdjungeln/db';
import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sendMail } from '@/lib/mail/send';
import { inactivityWarning } from '@/lib/mail/templates';

/**
 * Retention.
 *
 * An account nobody has touched for two years is deleted, but never without
 * warning: the mail goes out first, and the deletion only happens 30 days later
 * if the account is still untouched. Signing in clears the warning.
 */

const INACTIVE_DAYS = 730;
const GRACE_DAYS = 30;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export async function pruneInactiveAccounts(): Promise<{ warned: number; deleted: number }> {
  const inactiveSince = daysAgo(INACTIVE_DAYS);
  const graceExpired = daysAgo(GRACE_DAYS);

  // Delete first, so an account cannot be warned and deleted in the same run.
  const deleted = await db()
    .delete(schema.users)
    .where(
      and(
        lt(schema.users.lastSeenAt, inactiveSince),
        isNotNull(schema.users.deletionWarnedAt),
        lt(schema.users.deletionWarnedAt, graceExpired),
      ),
    )
    .returning({ id: schema.users.id });

  const toWarn = await db()
    .select({
      id: schema.users.id,
      email: schema.users.email,
      lastSeenAt: schema.users.lastSeenAt,
    })
    .from(schema.users)
    .where(
      and(lt(schema.users.lastSeenAt, inactiveSince), isNull(schema.users.deletionWarnedAt)),
    );

  let warned = 0;
  for (const user of toWarn) {
    const days = Math.floor((Date.now() - user.lastSeenAt.getTime()) / (24 * 60 * 60 * 1000));
    const result = await sendMail(inactivityWarning(user.email, days, env().APP_URL));
    if (!result.delivered) continue;

    await db()
      .update(schema.users)
      .set({ deletionWarnedAt: new Date() })
      .where(eq(schema.users.id, user.id));
    warned += 1;
  }

  return { warned, deleted: deleted.length };
}

/** Old cached ads and digest bookkeeping are not worth keeping forever. */
export async function pruneCaches(): Promise<{ ads: number; digestRows: number }> {
  const cutoff = daysAgo(30);
  const ads = await db()
    .delete(schema.cachedAds)
    .where(lt(schema.cachedAds.fetchedAt, cutoff))
    .returning({ id: schema.cachedAds.id });
  const digestRows = await db()
    .delete(schema.digestSeenAds)
    .where(lt(schema.digestSeenAds.seenAt, daysAgo(90)))
    .returning({ adId: schema.digestSeenAds.adId });

  return { ads: ads.length, digestRows: digestRows.length };
}

export { sql };
