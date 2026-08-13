import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import type { Database } from '@/lib/database.types';

/**
 * Session refresh + deny-by-default route protection.
 *
 * The stock Supabase middleware only refreshes cookies; it authorizes nothing.
 * Dropping it in as-is would silently turn every route that relied on Clerk's
 * `auth.protect()` into an anonymous public endpoint, because a Route Handler
 * that forgets to check the session would no longer be caught by anything. So
 * this composes the refresh with the route matching the Clerk middleware used
 * to do, and the default branch is DENY.
 *
 * What this does NOT do is check roles. Role lives in `public.users.role`, which
 * means a database round-trip on every matched request, and the value in the JWT
 * would be stale anyway. Admin routes are gated here on *authentication* only;
 * ADMIN itself is enforced by the route handler and, underneath it, by the RLS
 * policies on `songs` / `upload_jobs`.
 */

const PUBLIC_ROUTES = [
  /^\/$/,
  // The OAuth / email-confirmation code exchange. It must be reachable while
  // signed out — that is the entire point of it — and it authenticates by the
  // single-use `code` in the query string, not by a session.
  /^\/auth\/callback$/,
  // The public catalogue. Both were public under Clerk too.
  /^\/api\/get-songs$/,
  /^\/api\/search$/,
  // Artist discovery: the directory page and the two endpoints behind it. The
  // `/^\/artist\/.+$/` entry below does NOT cover `/artists` — it requires the
  // trailing slash — so without these the whole feature would be signed-in-only
  // despite being part of the same public catalogue. `/api/admin/artist-photo`
  // is deliberately NOT listed: it stays deny-by-default, so an anonymous caller
  // is refused here before `requireAdmin()` is ever reached.
  /^\/artists$/,
  /^\/api\/artists(\/.*)?$/,
  // Album discovery, and the same trailing-slash trap: `/^\/album\/.+$/` below
  // does not match `/albums` either.
  /^\/albums$/,
  /^\/api\/albums(\/.*)?$/,
  // The full catalogue list that "All songs → Show all" leads to. `/` is public
  // and this is just the rest of the same list, so gating it would sign-in-wall
  // a page anonymous visitors can already see the first rows of.
  /^\/songs$/,
  // The singer/album/movie browse pages — public like `/`, not gated like
  // playlists. Signed-out visitors can already browse and listen from the
  // home page; these are the same catalogue filtered to one name.
  /^\/artist\/.+$/,
  /^\/album\/.+$/,
  /^\/movie\/.+$/,
];

const AUTH_ROUTES = [/^\/sign-in(\/.*)?$/, /^\/sign-up(\/.*)?$/];

const matches = (patterns: RegExp[], pathname: string) => patterns.some(re => re.test(pathname));

export async function updateSession(request: NextRequest) {
  // Every branch below must return a response derived from this object, or a
  // response that has had its cookies copied over. Returning a fresh
  // NextResponse instead drops the refreshed auth cookies and logs the user out
  // at random.
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not put anything between createServerClient and getUser(). getUser()
  // revalidates the token with the auth server; getSession() would just decode
  // whatever cookie the client sent, which is not a verification.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (matches(AUTH_ROUTES, pathname)) {
    if (user) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return copyCookies(supabaseResponse, NextResponse.redirect(url));
    }
    return supabaseResponse;
  }

  if (matches(PUBLIC_ROUTES, pathname)) {
    return supabaseResponse;
  }

  if (!user) {
    if (pathname.startsWith('/api/')) {
      return copyCookies(
        supabaseResponse,
        NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
      );
    }

    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    // Send the user back where they were aiming once they sign in. Only the
    // path and query are carried, never the origin, and the sign-in form runs
    // it through `safeNextPath` before navigating — so this cannot be turned
    // into an open redirect by a crafted inbound URL.
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return copyCookies(supabaseResponse, NextResponse.redirect(url));
  }

  return supabaseResponse;
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach(cookie => to.cookies.set(cookie));
  return to;
}
