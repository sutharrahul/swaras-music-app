/**
 * The one place a route handler or server action is allowed to learn who the
 * caller is.
 *
 * Rule R1: the actor comes only from the verified session. Nothing here accepts
 * an id from a body, a query param or a header, and no handler should ever build
 * its own version of this. `getUser()` (not `getSession()`) is what does the
 * verifying: it revalidates the access token with the auth server, whereas
 * `getSession()` only decodes whatever cookie the browser sent.
 *
 * Rule R5: the role is read from `public.users.role` on every call. It is never
 * taken from `app_metadata` (which would freeze at signup and survive a
 * demotion) nor from `user_metadata` (which the user can write from the
 * browser). That costs one PostgREST round-trip per request and is the point.
 *
 * Rule R3: this uses the request-bound publishable-key client, so every query it
 * makes is still filtered by RLS. The secret/service-role key is not imported
 * here and is not needed: `users_select_own` lets a signed-in user read exactly
 * their own row.
 */

import { ApiResponse } from '@/app/utils/ApiResponse';
import type { Database, Enums } from '@/lib/database.types';
import { createClient } from '@/utils/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AppUser = {
  /** `public.users.id` — the app's own id, not the Supabase auth uid. */
  id: string;
  email: string;
  role: Enums<'UserRole'>;
};

export type ServerClient = SupabaseClient<Database>;

type Resolution =
  | { supabase: ServerClient; user: AppUser }
  | {
      supabase: ServerClient;
      user: null;
      reason: 'anonymous' | 'no-profile' | 'inactive' | 'error';
    };

export type Authorized = { ok: true; supabase: ServerClient; user: AppUser };
export type AuthResult = Authorized | { ok: false; response: Response };

async function resolveActor(): Promise<Resolution> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return { supabase, user: null, reason: 'anonymous' };

  const { data: row, error } = await supabase
    .from('users')
    .select('id, email, role, status')
    .eq('supabase_user_id', authUser.id)
    .maybeSingle();

  if (error) {
    console.error('Failed to resolve app user for authenticated session:', error);
    return { supabase, user: null, reason: 'error' };
  }

  // Authenticated but no profile row. This is the fail-closed outcome of the
  // signup trigger's `ON CONFLICT DO NOTHING`: an email collision leaves the
  // auth identity with no app row rather than adopting somebody else's (R4 —
  // email is not proof of ownership). Treat it as an error state, never as a
  // reason to go and create or attach a row here.
  if (!row) return { supabase, user: null, reason: 'no-profile' };

  // The project deactivates users instead of deleting them, which only means
  // something if it revokes access. `current_app_user_id()` in SQL gates on the
  // same condition, so this mirrors what RLS would do anyway.
  if (row.status !== 'ACTIVE') return { supabase, user: null, reason: 'inactive' };

  return { supabase, user: { id: row.id, email: row.email, role: row.role } };
}

function denial(reason: 'anonymous' | 'no-profile' | 'inactive' | 'error'): Response {
  switch (reason) {
    case 'anonymous':
      return ApiResponse.error('Unauthorized: please sign in', 401);
    case 'no-profile':
      return ApiResponse.error('Forbidden: this account has no profile', 403);
    case 'inactive':
      return ApiResponse.error('Forbidden: this account is not active', 403);
    case 'error':
      return ApiResponse.error('Failed to resolve the signed-in account', 500);
  }
}

/** 401/403 unless there is a verified session mapped to an ACTIVE app user. */
export async function requireUser(): Promise<AuthResult> {
  const resolved = await resolveActor();
  if (!resolved.user) return { ok: false, response: denial(resolved.reason) };
  return { ok: true, supabase: resolved.supabase, user: resolved.user };
}

/** As `requireUser`, plus `role = 'ADMIN'` read live from the database. */
export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireUser();
  if (!result.ok) return result;
  if (result.user.role !== 'ADMIN') {
    return { ok: false, response: ApiResponse.error('Forbidden: admin access required', 403) };
  }
  return result;
}

/**
 * For endpoints that serve anonymous callers but show more to a signed-in one.
 * `user` is null for every failure mode, so the caller cannot accidentally treat
 * "no profile" as "signed in".
 */
export async function optionalUser(): Promise<{ supabase: ServerClient; user: AppUser | null }> {
  const resolved = await resolveActor();
  return { supabase: resolved.supabase, user: resolved.user };
}
