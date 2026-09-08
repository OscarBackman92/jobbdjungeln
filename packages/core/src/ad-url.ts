/**
 * Job ad URL normalisation.
 *
 * Two links to the same ad routinely differ only by tracking parameters or a
 * trailing slash. Comparing normalised forms is what stops the app from
 * offering to save an ad the user already tracks.
 */

const TRACKING_PARAMS = new Set([
  'fbclid',
  'gclid',
  'msclkid',
  'igshid',
  'mc_cid',
  'mc_eid',
  'ref',
  'referrer',
  'trk',
  'trackingId',
]);

function isTrackingParam(key: string): boolean {
  return key.startsWith('utm_') || TRACKING_PARAMS.has(key);
}

/** Canonical form for comparing and storing ad URLs. Non-http input is returned as-is. */
export function normalizeAdUrl(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return '';

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return raw;

  // http and https forms of the same ad are the same ad.
  url.protocol = 'https:';
  url.hostname = url.hostname.toLowerCase();
  url.hash = '';
  url.username = '';
  url.password = '';
  if (url.port === '443' || url.port === '80') url.port = '';
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');

  for (const key of [...url.searchParams.keys()]) {
    if (isTrackingParam(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();

  return url.toString();
}

export function adUrlsEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = normalizeAdUrl(a);
  return Boolean(left) && left === normalizeAdUrl(b);
}

/** True when the URL is safe to render as a link (no `javascript:` and friends). */
export function isSafeExternalUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}
