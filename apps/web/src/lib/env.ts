import 'server-only';
import { z } from 'zod';

/**
 * Server configuration, validated once at startup.
 *
 * A missing or malformed value fails the boot rather than surfacing as a
 * confusing runtime error later — and production is held to stricter rules than
 * development, so the app cannot start unprotected by accident.
 */

/** True while `next build` is collecting page data. */
function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === 'phase-production-build';
}

/**
 * The origin a host tells us it is serving on.
 *
 * APP_URL is only needed because links in e-mail have to point somewhere, and
 * a platform already knows its own address. Reading it means one less value to
 * copy by hand — and a hand-copied one is exactly how a deployment ends up
 * answering 500 on every route, because an origin that fails validation stops
 * the whole app rather than just the e-mail links.
 *
 * The project's production domain wins over the per-deployment URL: the latter
 * is unique to each deploy, and sessions are bound to the origin that issued
 * them, so it would sign everyone out on the next push.
 */
function hostProvidedOrigin(): string | undefined {
  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim();
  if (!host) return undefined;
  return /^https?:\/\//.test(host) ? host : `https://${host}`;
}

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) =>
    typeof value === 'boolean'
      ? value
      : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase()),
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

    /** Signs sessions and tokens. Rotating it logs everyone out. */
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET måste vara minst 32 tecken.'),
    /** Public origin, used for links in e-mail. No trailing slash. */
    APP_URL: z.url().transform((value) => value.replace(/\/+$/, '')),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    /** Brevo's HTTP API — SMTP ports are blocked on many hosts. */
    BREVO_API_KEY: z.string().optional(),
    SMTP_URL: z.string().optional(),
    EMAIL_FROM: z.string().default('Jobbdjungeln <no-reply@jobbdjungeln.se>'),

    /** Shared secret the scheduled jobs authenticate with. */
    CRON_SECRET: z.string().min(16).optional(),

    /** Published at /.well-known/security.txt when set. */
    CONTACT_EMAIL: z.email().optional(),

    JOBTECH_SEARCH_URL: z.string().optional(),
    JOBTECH_AD_URL: z.string().optional(),
    JOBTECH_TAXONOMY_URL: z.string().optional(),

    /**
     * Relaxes what only gets in the way of an automated suite: e-mail
     * verification and the rate limits. One switch rather than several, so
     * there is exactly one thing to refuse in production — which the check
     * below does.
     */
    AUTH_TEST_MODE: booleanish.default(false),
  })
  .superRefine((value, ctx) => {
    // `next build` runs with NODE_ENV=production but serves no requests, and a
    // build machine has no business holding the production secrets. The rules
    // below guard a running server, so they are skipped while building.
    if (value.NODE_ENV !== 'production' || isBuildPhase()) return;

    if (value.AUTH_TEST_MODE) {
      ctx.addIssue({
        code: 'custom',
        path: ['AUTH_TEST_MODE'],
        message: 'Testläget får aldrig vara påslaget i produktion.',
      });
    }
    if (!value.APP_URL.startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_URL'],
        message: 'APP_URL måste vara https i produktion.',
      });
    }
    if (!value.CRON_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['CRON_SECRET'],
        message: 'CRON_SECRET krävs i produktion, annars är jobb-endpointerna öppna.',
      });
    }
    if (Boolean(value.GOOGLE_CLIENT_ID) !== Boolean(value.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({
        code: 'custom',
        path: ['GOOGLE_CLIENT_SECRET'],
        message: 'Google-inloggning kräver både klient-id och klienthemlighet.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function load(): Env {
  const parsed = envSchema.safeParse({
    ...process.env,
    APP_URL: process.env.APP_URL?.trim() || hostProvidedOrigin(),
  });
  if (parsed.success) return parsed.data;

  const details = parsed.error.issues
    .map((issue) => `  ${issue.path.join('.') || '(rot)'}: ${issue.message}`)
    .join('\n');
  throw new Error(`Ogiltig miljökonfiguration:\n${details}`);
}

let cached: Env | undefined;

/** The validated environment. Parsed on first use, then cached. */
export function env(): Env {
  cached ??= load();
  return cached;
}

/** Whether Google sign-in should be offered at all. */
export function googleEnabled(): boolean {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env();
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
