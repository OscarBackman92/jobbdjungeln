import 'server-only';
import { addDays, formatShortDate, type IsoDate, today as todayIso } from '@jobbdjungeln/core';
import { schema } from '@jobbdjungeln/db';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { sendMail } from '@/lib/mail/send';
import { type ReminderItem, reminders as remindersTemplate } from '@/lib/mail/templates';

/**
 * The daily reminder mail.
 *
 * Only sent when there is something to say. An empty digest teaches people to
 * ignore the sender, and the next one that matters goes unread.
 */

/** Nudge about a saved job this many days before it has to be applied for. */
const APPLY_HORIZON_DAYS = 2;

export async function sendReminders(today: IsoDate = todayIso()): Promise<{
  considered: number;
  sent: number;
}> {
  const horizon = addDays(today, APPLY_HORIZON_DAYS);

  const rows = await db()
    .select({
      userId: schema.applications.userId,
      email: schema.users.email,
      company: schema.applications.company,
      title: schema.applications.title,
      applyBy: schema.applications.applyBy,
      nextActionAt: schema.applications.nextActionAt,
      stage: schema.applications.stage,
    })
    .from(schema.applications)
    .innerJoin(schema.users, eq(schema.applications.userId, schema.users.id))
    .where(
      and(
        eq(schema.users.reminderOptIn, true),
        eq(schema.users.emailVerified, true),
        isNull(schema.applications.archivedAt),
        sql`${schema.applications.stage} <> 'avslutad'`,
        or(
          and(
            lte(schema.applications.nextActionAt, today),
            eq(schema.applications.intent, 'active'),
          ),
          and(
            eq(schema.applications.stage, 'bevakad'),
            eq(schema.applications.intent, 'active'),
            lte(schema.applications.applyBy, horizon),
          ),
        ),
      ),
    );

  const byUser = new Map<string, { email: string; items: ReminderItem[] }>();

  for (const row of rows) {
    const entry = byUser.get(row.userId) ?? { email: row.email, items: [] };
    if (row.nextActionAt && row.nextActionAt <= today) {
      entry.items.push({
        company: row.company,
        title: row.title,
        due: formatShortDate(row.nextActionAt, today),
        reason: 'Följ upp',
      });
    } else if (row.applyBy) {
      entry.items.push({
        company: row.company,
        title: row.title,
        due: formatShortDate(row.applyBy, today),
        reason: 'Sök senast',
      });
    }
    byUser.set(row.userId, entry);
  }

  let sent = 0;
  for (const { email, items } of byUser.values()) {
    if (items.length === 0) continue;
    const result = await sendMail(remindersTemplate(email, items, env().APP_URL));
    if (result.delivered) sent += 1;
  }

  return { considered: byUser.size, sent };
}
