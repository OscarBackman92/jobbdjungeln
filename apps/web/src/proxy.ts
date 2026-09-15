import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

/**
 * An optimistic gate in front of the signed-in pages.
 *
 * This only looks for a session cookie — it does not validate it, because the
 * proxy runs before rendering and a database round trip here would sit on
 * every navigation. Validation still happens in the app layout, which is what
 * actually protects the data; this exists so an anonymous visitor gets a clean
 * redirect instead of a streamed shell they cannot use.
 *
 * Do not bounce cookie-holders away from /logga-in here. A stale cookie (for
 * example after the DB was replaced) would loop: guest pages → /oversikt →
 * requireUser → /logga-in → guest pages. Those pages already redirect when
 * getSession() confirms a real user.
 */

const PROTECTED = ['/oversikt', '/sparade', '/ansokningar', '/annonser', '/rapport', '/profil'];

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && PROTECTED.some((path) => pathname.startsWith(path))) {
    const url = new URL('/logga-in', request.url);
    // Come back to where they were headed once they are signed in.
    url.searchParams.set('nasta', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/oversikt/:path*',
    '/sparade/:path*',
    '/ansokningar/:path*',
    '/annonser/:path*',
    '/rapport/:path*',
    '/profil/:path*',
  ],
};
