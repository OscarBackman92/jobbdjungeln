import 'server-only';
import { operatorId, schema } from '@jobbdjungeln/db';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';
import { db } from './db.ts';
import { env, googleEnabled } from './env.ts';
import { sendMail } from './mail/send.ts';
import { resetPassword, verifyEmail } from './mail/templates.ts';

/**
 * Authentication.
 *
 * E-mail and password with mandatory verification, plus optional Google sign-in
 * that stays hidden until it is configured. Sessions are cookie-based rather
 * than tokens in localStorage: a session cookie cannot be read by script, which
 * is the whole point when the data behind it is someone's job search.
 */

const SESSION_DAYS = 30;
/** Re-issue the cookie when it is this old, so an active user never gets logged out. */
const SESSION_REFRESH_DAYS = 1;

const MIN_PASSWORD_LENGTH = 10;

function auth() {
  const config = env();

  return betterAuth({
    appName: 'Jobbdjungeln',
    baseURL: config.APP_URL,
    secret: config.AUTH_SECRET,

    // `usePlural` maps better-auth's singular model names onto the plural table
    // exports in our schema (user -> users), so the auth tables live in the same
    // migration history as everything else.
    database: drizzleAdapter(db(), { provider: 'pg', schema, usePlural: true }),

    user: {
      additionalFields: {
        // Generated server-side on every sign-up path, including social, and
        // never accepted from the client.
        operatorId: {
          type: 'string',
          required: false,
          input: false,
          defaultValue: () => operatorId(),
        },
        lastSeenAt: { type: 'date', required: false, input: false },
        weeklySummaryOptIn: { type: 'boolean', required: false, input: false },
        reminderOptIn: { type: 'boolean', required: false, input: false },
        deletionWarnedAt: { type: 'date', required: false, input: false },
        weeklySummarySentAt: { type: 'date', required: false, input: false },
      },
      deleteUser: {
        // Deleting the row cascades to everything the account owns.
        enabled: true,
      },
    },

    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      // No session until the address is confirmed.
      requireEmailVerification: !config.AUTH_SKIP_EMAIL_VERIFICATION,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        await sendMail(resetPassword(user.email, url));
      },
      onPasswordReset: async ({ user }) => {
        // A reset means the old password may be compromised; drop every session.
        await db().delete(schema.sessions).where(eq(schema.sessions.userId, user.id));
      },
    },

    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail(verifyEmail(user.email, url));
      },
    },

    socialProviders: googleEnabled()
      ? {
          google: {
            clientId: config.GOOGLE_CLIENT_ID ?? '',
            clientSecret: config.GOOGLE_CLIENT_SECRET ?? '',
          },
        }
      : {},

    account: {
      accountLinking: {
        // Google has verified the address, so linking it to an existing
        // account cannot be used to take one over.
        enabled: true,
        trustedProviders: ['google'],
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * SESSION_DAYS,
      updateAge: 60 * 60 * 24 * SESSION_REFRESH_DAYS,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    advanced: {
      useSecureCookies: config.NODE_ENV === 'production',
      defaultCookieAttributes: { sameSite: 'lax', httpOnly: true },
    },

    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      customRules: {
        // Credential endpoints are what gets attacked; hold them much tighter.
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60 * 60, max: 5 },
        '/forget-password': { window: 60 * 60, max: 5 },
        '/reset-password': { window: 60 * 60, max: 5 },
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({ data: { ...user, lastSeenAt: new Date() } }),
        },
      },
      session: {
        create: {
          after: async (session) => {
            // Signing in resets the inactivity clock and cancels any warning.
            await db()
              .update(schema.users)
              .set({ lastSeenAt: new Date(), deletionWarnedAt: null })
              .where(eq(schema.users.id, session.userId));
          },
        },
      },
    },

    plugins: [nextCookies()],
  });
}

let cached: ReturnType<typeof auth> | undefined;

export function getAuth(): ReturnType<typeof auth> {
  cached ??= auth();
  return cached;
}

export const PASSWORD_MIN_LENGTH = MIN_PASSWORD_LENGTH;
