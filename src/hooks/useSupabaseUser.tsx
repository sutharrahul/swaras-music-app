'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';

import { createClient } from '@/utils/supabase/client';

type SupabaseUserState = { user: User | null; isLoaded: boolean };

/**
 * The signed-in user, resolved once and shared by the whole app.
 *
 * This used to be a plain hook with its own `useState`: every component that
 * called it — Header, PlayList, MusicPlayer, UserMenu, and every route gate —
 * ran its own `getUser()` network round-trip and its own `onAuthStateChange`
 * subscription, independently, starting from `isLoaded: false` on every mount.
 * That is harmless on most pages, but `/admin` blocks its ENTIRE render behind
 * `isLoaded`, so navigating away and back re-ran the check and re-showed
 * "Loading admin access..." even though the session was already known — the
 * app was, quite literally, re-checking auth on every visit.
 *
 * The state now lives once, in `SupabaseUserProvider` below (mounted in
 * `Providers.tsx`, which — like the QueryClient beside it — is created once
 * for the life of the tab and never unmounts). Every `useSupabaseUser()` call
 * site is unchanged; they all read the same already-resolved value instead of
 * redoing the check on their own remount.
 *
 * SECURITY: this is a *client* value and must never be the thing that decides
 * whether something is allowed. It only picks which controls to draw. Anything
 * that matters is decided again on the server by `requireUser()` /
 * `requireAdmin()` in `src/lib/auth.ts`, by the deny-by-default middleware, and
 * by RLS underneath both. Passing `user.id` to an endpoint would be exactly the
 * IDOR this migration removes — no handler accepts one.
 */
const SupabaseUserContext = createContext<SupabaseUserState | undefined>(undefined);

export function SupabaseUserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SupabaseUserState>({ user: null, isLoaded: false });

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    // Runs first because it revalidates the token with the auth server;
    // `onAuthStateChange` then keeps the value live across sign-in, sign-out
    // and token refresh, including in another tab.
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

  return <SupabaseUserContext.Provider value={state}>{children}</SupabaseUserContext.Provider>;
}

export function useSupabaseUser() {
  const context = useContext(SupabaseUserContext);
  if (!context) {
    throw new Error('useSupabaseUser must be used within a SupabaseUserProvider');
  }
  return context;
}
