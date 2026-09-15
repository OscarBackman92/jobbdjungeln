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
    // On Vercel the exact public host is not knowable at boot: which alias or
    // preview URL a request arrives on depends on the deployment, and a value
    // guessed at startup (from a system env var, or copied by hand into a
    // dashboard) can be wrong in a way that fails silently — the app still
    // boots, but baseURL is the one thing better-auth's CSRF origin-check
    // gates, so every sign-in and sign-up then fails with "Invalid origin".
    // Resolving it from the incoming request's own Host header instead is
    // correct by construction: that host is definitionally what routed the
    // request here. allowedHosts is the allowlist that keeps this from
    // trusting an attacker-chosen Host — better-auth documents this exact
    // `*.vercel.app` pattern for preview deployments.
    baseURL: process.env.VERCEL
      ? {
          allowedHosts: ['*.vercel.app', new URL(config.APP_URL).host],
          protocol: 'https' as const,
          fallback: config.APP_URL,
        }
      : config.APP_URL,
    // Explicit origins: object-form allowedHosts should fold into this, but after
    // the custom-domain cutover production returned "Invalid origin" for
    // APP_URL itself — so keep both until that path is trustworthy.
    trustedOrigins: [config.APP_URL, 'https://*.vercel.app'],
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
      requireEmailVerification: !config.AUTH_TEST_MODE,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: async ({ user, url }) => {
        // Delivery failures stay quiet here: a 500 would tell an attacker the
        // address exists. The mail layer already logs the failure.
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
        const result = await sendMail(verifyEmail(user.email, url));
        // Unlike password reset, a silent failure here strands the user: the
        // form says "check your mail" and there is no resend path yet.
        // Console delivery is fine locally; production refuses to boot without
        // a real provider (env.ts).
        if (!result.delivered) {
          throw new Error('Kunde inte skicka bekräftelsemejlet. Försök igen om en stund.');
        }
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

    // Always on, so the rule cannot be lost by accident; the test suite raises
    // the ceiling rather than switching it off, and it still runs against a
    // limiter.
    rateLimit: {
      enabled: true,
      window: 60,
      max: config.AUTH_TEST_MODE ? 10_000 : 30,
      // The credential endpoints are what gets attacked, so they are held much
      // tighter than the rest. In test mode the ceiling is raised rather than
      // removed — an empty rule set would fall back to the library's own
      // defaults, which a suite creating accounts from one IP trips at once.
      customRules: {
        '/sign-in/email': { window: 60, max: config.AUTH_TEST_MODE ? 10_000 : 5 },
        '/sign-up/email': { window: 60 * 60, max: config.AUTH_TEST_MODE ? 10_000 : 5 },
        '/forget-password': { window: 60 * 60, max: config.AUTH_TEST_MODE ? 10_000 : 5 },
        '/reset-password': { window: 60 * 60, max: config.AUTH_TEST_MODE ? 10_000 : 5 },
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
