-- ---------------------------------------------------------------------------
-- Row Level Security.
--
-- RLS is the last line of defence, not the only one: a route handler that
-- forgets to authorize must still not be able to read another user's rows. Every
-- table below gets RLS enabled; a table with RLS enabled and no policy is
-- readable by nobody except `service_role` (which bypasses RLS), which is the
-- intended state for `webhook_events`.
--
-- AVOIDING 42P17 (infinite recursion in policy)
-- ---------------------------------------------
-- The classic footgun is a policy ON public.users whose USING clause SELECTs
-- FROM public.users — evaluating the policy re-runs the policy, forever. Both
-- helpers below are SECURITY DEFINER, so their body executes as the function
-- owner (the migration role, which owns `users`). A table owner is exempt from
-- that table's RLS, so the inner SELECT never re-enters the policy and the
-- recursion never starts.
--
-- Two things this depends on, both deliberate:
--   * `search_path` is pinned to the empty string and every object inside the
--     function body is schema-qualified. A SECURITY DEFINER function with an
--     inherited search_path can be hijacked by a caller who creates a shadowing
--     object in a schema they control.
--   * NOTHING here uses `ALTER TABLE ... FORCE ROW LEVEL SECURITY`. Forcing RLS
--     applies policies to the owner too, which would reintroduce exactly the
--     recursion the SECURITY DEFINER hop is there to avoid.
-- ---------------------------------------------------------------------------

-- The app's own users.id for the caller, or NULL when the caller is anonymous
-- or has no provisioned row. NULL makes every ownership comparison fail, so the
-- default is deny.
--
-- Gated on status = 'ACTIVE': the project deactivates users (status =
-- 'INACTIVE') instead of deleting them, and that only means something if it
-- actually revokes access.
create or replace function public.current_app_user_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.id
  from public.users u
  where u.supabase_user_id = (select auth.uid())
    and u.status = 'ACTIVE'
$$;

-- Role lives in the database and nowhere else. Never read a role from
-- `user_metadata` (the user can write it from the browser) and never copy it
-- into `app_metadata` at signup (it would freeze and survive a demotion).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.supabase_user_id = (select auth.uid())
      and u.status = 'ACTIVE'
      and u.role = 'ADMIN'
  )
$$;

revoke execute on function public.current_app_user_id() from public;
revoke execute on function public.is_admin() from public;
grant execute on function public.current_app_user_id() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileges
--
-- Supabase's default privileges hand `anon` and `authenticated` ALL on every new
-- table in `public`. Reset that and grant back only what each role needs; RLS
-- then narrows it to rows. Table privileges are checked BEFORE policies, so a
-- missing GRANT is a hard stop regardless of policy.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- Catalogue: world-readable, admin-writable (writes are gated by policy).
grant select on public.songs, public.artists, public.albums, public.movies,
                public.song_credits, public.album_artists
  to anon, authenticated;
grant insert, update, delete on public.songs, public.artists, public.albums,
                public.movies, public.song_credits, public.album_artists
  to authenticated;

-- users: a signed-in user may read their own row and edit only their display
-- fields. Column-level privileges — not a policy — are what stop a user from
-- promoting themselves to ADMIN, changing their status, or re-pointing
-- supabase_user_id at someone else. RLS cannot restrict columns.
grant select on public.users to authenticated;
grant update ("firstName", "lastName", profile_image_url) on public.users to authenticated;

-- Per-user data.
grant select, insert, update, delete on public.playlists, public.playlist_songs,
                public.likes, public.upload_jobs, public.upload_job_items
  to authenticated;

-- public.webhook_events: no grant at all. Only service_role touches it.

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.users            enable row level security;
alter table public.songs            enable row level security;
alter table public.artists          enable row level security;
alter table public.albums           enable row level security;
alter table public.movies           enable row level security;
alter table public.song_credits     enable row level security;
alter table public.album_artists    enable row level security;
alter table public.playlists        enable row level security;
alter table public.playlist_songs   enable row level security;
alter table public.likes            enable row level security;
alter table public.upload_jobs      enable row level security;
alter table public.upload_job_items enable row level security;
alter table public.webhook_events   enable row level security;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select to authenticated
  using (supabase_user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update to authenticated
  using (supabase_user_id = (select auth.uid()))
  with check (supabase_user_id = (select auth.uid()));

-- No INSERT policy: rows are created by the auth.users trigger, which is
-- SECURITY DEFINER and therefore not subject to these policies. No DELETE
-- policy: songs.uploaded_by_user_id is ON DELETE RESTRICT, so deleting a user
-- is an operator action, not a self-service one.

-- ---------------------------------------------------------------------------
-- songs + catalogue metadata: readable by anyone, writable only by an admin
-- ---------------------------------------------------------------------------
drop policy if exists songs_select_public on public.songs;
create policy songs_select_public on public.songs
  for select to anon, authenticated using (true);

drop policy if exists songs_write_admin on public.songs;
create policy songs_write_admin on public.songs
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists artists_select_public on public.artists;
create policy artists_select_public on public.artists
  for select to anon, authenticated using (true);

drop policy if exists artists_write_admin on public.artists;
create policy artists_write_admin on public.artists
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists albums_select_public on public.albums;
create policy albums_select_public on public.albums
  for select to anon, authenticated using (true);

drop policy if exists albums_write_admin on public.albums;
create policy albums_write_admin on public.albums
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists movies_select_public on public.movies;
create policy movies_select_public on public.movies
  for select to anon, authenticated using (true);

drop policy if exists movies_write_admin on public.movies;
create policy movies_write_admin on public.movies
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists song_credits_select_public on public.song_credits;
create policy song_credits_select_public on public.song_credits
  for select to anon, authenticated using (true);

drop policy if exists song_credits_write_admin on public.song_credits;
create policy song_credits_write_admin on public.song_credits
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists album_artists_select_public on public.album_artists;
create policy album_artists_select_public on public.album_artists
  for select to anon, authenticated using (true);

drop policy if exists album_artists_write_admin on public.album_artists;
create policy album_artists_write_admin on public.album_artists
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- playlists / playlist_songs / likes: owner only, read and write
--
-- `(select public.current_app_user_id())` rather than a bare call: wrapping a
-- STABLE function in a scalar subquery lets the planner hoist it into an
-- InitPlan and evaluate it once per statement instead of once per row.
-- ---------------------------------------------------------------------------
drop policy if exists playlists_owner_all on public.playlists;
create policy playlists_owner_all on public.playlists
  for all to authenticated
  using (user_id = (select public.current_app_user_id()))
  with check (user_id = (select public.current_app_user_id()));

-- The EXISTS below reads public.playlists, which is itself under RLS — that is
-- fine and is not recursion: the playlists policy does not reference
-- playlist_songs. It also means a row whose parent playlist is invisible is
-- itself invisible, which is exactly the wanted behaviour.
drop policy if exists playlist_songs_owner_all on public.playlist_songs;
create policy playlist_songs_owner_all on public.playlist_songs
  for all to authenticated
  using (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_songs.playlist_id
        and p.user_id = (select public.current_app_user_id())
    )
  )
  with check (
    exists (
      select 1 from public.playlists p
      where p.id = playlist_songs.playlist_id
        and p.user_id = (select public.current_app_user_id())
    )
  );

drop policy if exists likes_owner_all on public.likes;
create policy likes_owner_all on public.likes
  for all to authenticated
  using (user_id = (select public.current_app_user_id()))
  with check (user_id = (select public.current_app_user_id()));

-- ---------------------------------------------------------------------------
-- Upload pipeline: the owning admin only.
--
-- Both conditions are required. Ownership alone would let a demoted admin keep
-- draining their old jobs; is_admin() alone would let any admin poll another
-- admin's job, which is the bug the DB-backed queue was introduced to fix.
-- ---------------------------------------------------------------------------
drop policy if exists upload_jobs_owner_all on public.upload_jobs;
create policy upload_jobs_owner_all on public.upload_jobs
  for all to authenticated
  using (user_id = (select public.current_app_user_id()) and (select public.is_admin()))
  with check (user_id = (select public.current_app_user_id()) and (select public.is_admin()));

drop policy if exists upload_job_items_owner_all on public.upload_job_items;
create policy upload_job_items_owner_all on public.upload_job_items
  for all to authenticated
  using (
    exists (
      select 1 from public.upload_jobs j
      where j.id = upload_job_items.job_id
        and j.user_id = (select public.current_app_user_id())
    )
    and (select public.is_admin())
  )
  with check (
    exists (
      select 1 from public.upload_jobs j
      where j.id = upload_job_items.job_id
        and j.user_id = (select public.current_app_user_id())
    )
    and (select public.is_admin())
  );

-- ---------------------------------------------------------------------------
-- webhook_events: RLS enabled, zero policies, zero grants. Reachable only by
-- service_role.
-- ---------------------------------------------------------------------------
