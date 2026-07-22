'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

import { createClient } from '@/utils/supabase/client';

/**
 * The signed-in user, for rendering only.
 *
 * This replaces Clerk's `useUser()`. It reports `isLoaded` separately from
 * `user` so a component can tell "still checking" from "definitely signed out"
 * and avoid flashing a sign-in prompt at a signed-in user.
 *
 * SECURITY: this is a *client* value and must never be the thing that decides
 * whether something is allowed. It only picks which controls to draw. Anything
 * that matters is decided again on the server by `requireUser()` /
 * `requireAdmin()` in `src/lib/auth.ts`, by the deny-by-default middleware, and
 * by RLS underneath both. Passing `user.id` to an endpoint would be exactly the
 * IDOR this migration removes — no handler accepts one.
 *
 * `getUser()` runs first because it revalidates the token with the auth server;
 * `onAuthStateChange` then keeps the value live across sign-in, sign-out and
 * token refresh, including in another tab.
 */
export function useSupabaseUser() {
  const [state, setState] = useState<{ user: User | null; isLoaded: boolean }>({
    user: null,
    isLoaded: false,
  });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (active) setState({ user: data.user, isLoaded: true });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setState({ user: session?.user ?? null, isLoaded: true });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
