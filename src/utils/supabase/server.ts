import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import type { Database } from '@/lib/database.types';

/**
 * Request-bound Supabase client for Server Components, Server Actions and Route
 * Handlers.
 *
 * This is the client almost everything server-side should use. It carries the
 * caller's session cookie, so PostgREST sees the caller's own JWT and Row Level
 * Security applies — which is what makes it safe by default. It uses the
 * publishable key, not the secret key: the secret key bypasses RLS entirely and
 * must be reached for only when a request genuinely has no user (a webhook, a
 * cron sweep), in a `server-only` module of its own.
 *
 * `cookies()` is async in Next 15, so this factory is async too. Create a new
 * client per request; never hoist one into a module-level singleton, or one
 * user's session will be served to another.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot set cookies. That is fine and expected:
            // the middleware's updateSession() has already written the refreshed
            // tokens onto the response for this request. Swallowing it here is
            // only safe *because* the middleware runs — if you ever drop the
            // middleware, sessions will stop refreshing silently.
          }
        },
      },
    }
  );
}

/**
 * A client bound to a *snapshot* of this request's cookies, for work that
 * outlives the response.
 *
 * `createClient()` above reads `cookies()` lazily on every query, which is
 * exactly wrong for the fire-and-forget background pass in
 * `POST /api/upload-song`: by the time it inserts a song the request store may
 * no longer be readable, and setting a refreshed cookie certainly is not. This
 * captures the cookies once, while the request is alive, and never writes any
 * back — so it keeps the caller's identity (and therefore RLS) without touching
 * a store that has gone away.
 *
 * It carries the access token as it was at request time, so it stops working
 * when that token expires. Fine for a job that runs for seconds; not a substitute
 * for a real background worker.
 */
export async function createSnapshotClient() {
  const cookieStore = await cookies();
  const snapshot = cookieStore.getAll();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return snapshot;
        },
        setAll() {
          // Deliberately a no-op: there is no response left to write to.
        },
      },
    }
  );
}
