-- ---------------------------------------------------------------------------
-- Provisioning public.users from auth.users.
--
-- WHY THIS IS DELICATE
-- -------------------
-- A trigger on auth.users runs inside GoTrue's own signup transaction. Anything
-- it raises aborts that transaction, so GoTrue returns 500 "Database error
-- saving new user" and no auth identity is created at all. A naive
-- `INSERT INTO public.users (email, ...)` therefore turns any collision on
-- `users_email_key` into a broken signup — and the failure is opaque, because
-- the real error is a unique violation the client never sees.
--
-- WHY `ON CONFLICT DO NOTHING` AND NOT `DO UPDATE`
-- ------------------------------------------------
-- The tempting fix is `on conflict (email) do update set supabase_user_id =
-- new.id`, i.e. adopt the existing row. That is an account-takeover primitive:
-- anyone who can sign up with an address that already exists in public.users
-- inherits that row — its playlists, its likes, and its role. Email is not proof
-- of ownership, and admin email addresses have historically been public from
-- this app's own endpoints. So identities are NEVER linked by email.
--
-- `ON CONFLICT DO NOTHING` with no conflict target covers every unique
-- constraint on the table (pkey, users_email_key, the supabase_user_id unique
-- index), so this function cannot raise a unique violation and cannot break
-- signup, while never adopting a row it has no right to.
--
-- WHAT HAPPENS ON A COLLISION
-- ---------------------------
-- The auth identity is created and has no public.users row. That state is
-- fail-closed, not fail-open: current_app_user_id() returns NULL, is_admin()
-- returns false, and the users SELECT policy matches nothing, so the account can
-- read the public catalogue and nothing else. The app should treat "authenticated
-- but no profile row" as an error state and say so; resolving the duplicate is
-- an operator action, because only an operator can establish who actually owns
-- the address.
--
-- In practice this project starts from an empty users table (Supabase is the
-- sole identity source; there is no user base to migrate), so a collision can
-- only come from rows left behind by the Clerk era.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- public.users.email is NOT NULL. Phone-only signups have no email; skipping
  -- them keeps signup working rather than aborting it with a not-null violation.
  if new.email is null then
    return new;
  end if;

  insert into public.users (
    email,
    supabase_user_id,
    "firstName",
    "lastName",
    signup_method
  )
  values (
    new.email,
    new.id,
    -- raw_user_meta_data is written by the client at signup, so it is untrusted.
    -- Display-only fields are fine to seed from it; `role` and `status` are NOT,
    -- and are left to their column defaults (USER / ACTIVE).
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    -- raw_app_meta_data is written by GoTrue, not by the client.
    case
      when new.raw_app_meta_data ->> 'provider' = 'google' then 'GOOGLE'
      else 'EMAIL'
    end::public."SignupMethod"
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Not handled here, deliberately:
--   * an email change in auth.users does not propagate to public.users.email.
--   * deleting an auth.users row leaves the public.users row in place with
--     supabase_user_id set to NULL (the FK is ON DELETE SET NULL, because
--     songs.uploaded_by_user_id is ON DELETE RESTRICT and a cascade from
--     auth.users would either fail or destroy the catalogue). The orphaned row
--     keeps its email, so re-signing-up with that address hits the DO NOTHING
--     path above.
-- Both are operator/product decisions rather than defaults worth guessing at.
