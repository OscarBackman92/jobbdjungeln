import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getAuth } from './auth.ts';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  operatorId: string;
  weeklySummaryOptIn: boolean;
  reminderOptIn: boolean;
}

/**
 * The signed-in user, or null.
 *
 * Wrapped in React's `cache` so several server components on one page share a
 * single lookup instead of each hitting the session store.
 */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session?.user) return null;

  const user = session.user as typeof session.user & {
    operatorId?: string;
    weeklySummaryOptIn?: boolean;
    reminderOptIn?: boolean;
  };

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? '',
    image: user.image ?? null,
    emailVerified: user.emailVerified,
    operatorId: user.operatorId ?? '',
    weeklySummaryOptIn: user.weeklySummaryOptIn ?? true,
    reminderOptIn: user.reminderOptIn ?? true,
  };
});

/** The signed-in user, or a redirect to the sign-in page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect('/logga-in');
  return user;
}
