import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@/utils/supabase/server';

/**
 * PKCE code exchange.
 *
 * Supabase sends the browser here after an email confirmation (and after any
 * OAuth provider we add later) with a single-use `?code=`. Exchanging it sets
 * the session cookies — which is why this has to be a Route Handler and not a
 * Server Component: only a Route Handler can write cookies.
 *
 * The route is in the middleware's public list; it authenticates by the code
 * itself. `next` is deliberately restricted to a same-site absolute path, so a
 * crafted link cannot bounce a freshly signed-in user off to another origin.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const next = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth code exchange failed:', error.message);
    return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
