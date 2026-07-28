'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';

import { createClient } from '@/utils/supabase/client';

/**
 * The TanStack Query cache, and the thing that empties it when the user changes.
 *
 * WHY THE SUBSCRIPTION IS NOT OPTIONAL
 * ------------------------------------
 * This provider lives in the root layout and holds the client in `useState`, so
 * it is created once for the life of the tab. Sign-in and sign-out both do
 * `router.push`/`replace` + `router.refresh()`, which re-runs the middleware and
 * every Server Component but PRESERVES client state by design — there is no
 * remount, so nothing here is torn down.
 *
 * Without this, on a shared device, everything the previous user's session
 * fetched stays readable for the full `gcTime` (10 minutes): `/playlist` renders
 * their playlists, liked songs render their likes, and `['admin-status']` still
 * says `isAdmin: true`, so `/admin/upload-song` renders its form for somebody
 * who is not an admin. (Only renders — every one of those endpoints re-checks on
 * the server, so this is a data-leak and a confusing-UI bug, not a privilege
 * escalation.)
 *
 * `clear()` rather than `invalidateQueries()`: invalidation leaves the stale
 * data in place and refetches, so the old user's rows are still on screen until
 * the network answers. `clear()` drops them synchronously.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            refetchOnMount: false,
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  useEffect(() => {
    const supabase = createClient();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(event => {
      // SIGNED_IN and SIGNED_OUT only. TOKEN_REFRESHED and USER_UPDATED fire for
      // the SAME user — clearing on those would wipe the cache roughly hourly
      // and refetch the whole screen for no reason. INITIAL_SESSION fires on
      // every mount, including a page load with nothing cached yet.
      if (event === 'SIGNED_OUT' || event === 'SIGNED_IN') {
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
