/**
 * Auth e-mail links must always point at the canonical public origin.
 *
 * On Vercel the request Host can be either the custom domain or a
 * `*.vercel.app` alias. better-auth builds reset/verify URLs from that Host,
 * which made password-reset links flip between the public domain and the
 * project alias. Rewriting to APP_URL keeps the token path and query intact.
 */
export function canonicalizeAuthEmailUrl(url: string, appUrl: string): string {
  const app = new URL(appUrl);
  const parsed = new URL(url);
  parsed.protocol = app.protocol;
  parsed.host = app.host;
  return parsed.toString();
}
