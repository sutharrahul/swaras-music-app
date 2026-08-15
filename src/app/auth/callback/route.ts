import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

import { createClient } from '@/utils/supabase/server';

/**
 * The landing point for every emailed auth link and for OAuth returns.
 *
 * Supabase can hand a session back in three different shapes, and this route
 * has to cope with two of them:
 *
 *  1. `?code=` — the PKCE exchange. The browser that STARTED the flow holds a
 *     `code_verifier` cookie, and `exchangeCodeForSession` needs both halves.
 *     This is what the browser client produces (`createBrowserClient` defaults
 *     to PKCE — the recover request really does send a `code_challenge`).
 *  2. `?token_hash=&type=` — a one-time token verified with `verifyOtp`. No
 *     verifier cookie is involved, so it works even when the link is opened in
 *     a DIFFERENT browser from the one that requested it. That is the common
 *     case for password recovery: people request the reset on a laptop and open
 *     the mail on a phone, or the link opens in Gmail's in-app browser.
 *  3. `#access_token=…` in the URL FRAGMENT — the legacy implicit flow. This
 *     route can never handle that one: a fragment is not sent to the server, so
 *     the request arrives here with no usable parameter at all. Links built
 *     from `admin/generate_link` without a PKCE challenge come back this way,
 *     which is exactly how a recovery link ends up on `/sign-in?error=missing_code`.
 *     Keeping the recovery template on `{{ .ConfirmationURL }}` with a
 *     PKCE-initiated request, or switching it to `{{ .TokenHash }}`, both avoid it.
 *
 * Only a Route Handler can write cookies, which is why this is not a Server
 * Component. The route is in the middleware's public list; it authenticates by
 * the code or token itself. `next` is restricted to a same-site absolute path so
 * a crafted link cannot bounce a freshly authenticated user to another origin.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const nextParam = searchParams.get('next');
  const next = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : '/';

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // The overwhelmingly likely cause is that the link was opened in a
      // different browser than the one that requested it, so the PKCE verifier
      // cookie is missing. Say so, rather than showing a generic failure.
      console.error('Auth code exchange failed:', error.message);
      return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) {
      console.error('Auth token verification failed:', error.message);
      return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
}
