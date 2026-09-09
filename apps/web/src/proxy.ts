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
 */

const PROTECTED = ['/oversikt', '/sparade', '/ansokningar', '/annonser', '/rapport', '/profil'];
const GUEST_ONLY = ['/logga-in', '/skapa-konto'];

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(getSessionCookie(request));

  if (!hasSession && PROTECTED.some((path) => pathname.startsWith(path))) {
    const url = new URL('/logga-in', request.url);
    // Come back to where they were headed once they are signed in.
    url.searchParams.set('nasta', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && GUEST_ONLY.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL('/oversikt', request.url));
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
    '/logga-in',
    '/skapa-konto',
  ],
};
