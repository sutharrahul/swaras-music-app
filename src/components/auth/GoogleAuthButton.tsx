'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { safeNextPath } from '@/lib/authForm';

/** Google's own four-color "G" mark — expected on a "Sign in with Google" button. */
function GoogleGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-4 w-4">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.95v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.95A9 9 0 0 0 0 9c0 1.45.35 2.83.95 4.05l3.02-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .95 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * OAuth sign-in, shared by /sign-in and /sign-up — both start the same flow,
 * there is no separate "register with Google."
 *
 * `/auth/callback` already does generic PKCE code exchange (built for this),
 * so nothing there changes: this button is the entire client-side addition.
 * The `next` param is forwarded the same way the password form does it via
 * `safeNextPath`, so a visitor bounced to /sign-in?next=/admin lands back on
 * /admin after Google too, not just after a password login.
 */
export default function GoogleAuthButton({ next }: { next?: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setError(null);
    setPending(true);

    const supabase = createClient();
    const redirectTo = new URL('/auth/callback', window.location.origin);
    redirectTo.searchParams.set('next', safeNextPath(next ?? null));

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectTo.toString() },
    });

    // A real redirect to Google follows on success, so this only runs when the
    // request never left the browser (network failure, provider not enabled).
    if (oauthError) {
      setError('Could not start Google sign-in. Try again in a moment.');
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        onClick={handleClick}
        disabled={pending}
        className="w-full border-border bg-transparent text-white hover:bg-secondary"
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleGlyph />
        )}
        Continue with Google
      </Button>
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
