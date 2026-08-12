-- ---------------------------------------------------------------------------
-- Artist discovery: a photo on the profile side-table, and the aggregate that
-- derives the artist list from the songs that actually exist.
--
-- WHY THE AGGREGATE READS songs.artist AND NOT song_credits
-- ---------------------------------------------------------
-- `songs.artist text[]` is the source of truth for "which songs belong to this
-- artist" and stays that way. `public.artists` is used here ONLY as a profile
-- side-table keyed by `name` — it has no FK to songs, and the relational
-- `song_credits` structure still has no write path anywhere in the app (see the
-- "artists / albums / movies" section of 20260809130000_init_schema.sql).
-- Consequently an artist with no row in `public.artists` is normal, not an
-- error: it simply has no photo yet.
--
-- NO COMMA SPLITTING, here or anywhere. `unnest` returns each array element
-- exactly as stored, so 'Shakira, Burna Boy' is one artist. Splitting on a comma
-- would shred real names — "Tyler, The Creator", "Earth, Wind & Fire" — and
-- there is no reliable way to tell the two cases apart. Bad tags are fixed by
-- hand in the admin song-edit dialog, which already splits comma-separated FORM
-- input on save.
--
-- RLS: nothing to do. `public.artists` was already fully configured in
-- 20260809130100_rls.sql — RLS enabled, `artists_select_public` (anon +
-- authenticated), `artists_write_admin` (is_admin() on both USING and WITH
-- CHECK), and the table grants. The table has simply never been read or written
-- by any code until now.
-- ---------------------------------------------------------------------------

-- --- 1. artists.image_path ---------------------------------------------------
-- A Storage object KEY, never a URL. `image_url` (from the original schema) is
-- the wrong shape for exactly the reason `songs.cover_url` was dropped in
-- 20260809150000_storage.sql section 1: a URL drifts, a path is stable, and the
-- URL is a pure function of the path. `image_url` is left in place, unused and
-- NULL — dropping a column is not something to do in passing, and nothing in
-- `src/` has ever read it.
alter table public.artists add column if not exists image_path text;

comment on column public.artists.image_path is
  'Object key in the public artist-images bucket. Never a URL; derive with artistImageUrl().';

-- --- 2. artist_song_counts() -------------------------------------------------
-- NOT security definer, unlike public.song_like_counts.
--
-- song_like_counts needs SECURITY DEFINER because `public.likes` is under an
-- owner-only policy, so an invoker-rights aggregate would count only the
-- caller's own rows and render 0 for everyone else. `public.songs` has no such
-- problem: `songs_select_public` is `using (true)` for anon and authenticated
-- alike, so an invoker-rights function already sees the whole catalogue for
-- every caller. Adding SECURITY DEFINER would buy nothing and cost the audit
-- burden of a privilege-escalating function.
--
-- `set search_path = ''` is kept regardless — it is house style on every
-- function in this project, it costs nothing, and it makes the schema
-- qualification below mandatory rather than optional.
--
-- The lateral column is aliased `u.artist`, deliberately NOT `artist_name`, so
-- it can never resolve to the function's own OUT column of that name — the same
-- hygiene as `l.song_id` / `p_song_ids` in song_like_counts.
--
-- 'Unknown Artist' is excluded. `/api/upload-song/complete` defaults to it when
-- a file carries no ID3 artist tag, so it is a placeholder for "untagged", not a
-- person, and it would otherwise be the largest card in the rail. Those songs
-- stay fully reachable through "All songs" and search.
--
-- `cross join lateral unnest(...)` rather than putting `unnest()` and an
-- aggregate in the same target list, which Postgres rejects. `cross join` (not
-- `left join lateral`) drops songs whose artist array is empty — correct: a song
-- with no artist belongs to no artist card.
create or replace function public.artist_song_counts()
returns table (artist_name text, song_count bigint)
language sql
stable
set search_path = ''
as $$
  select u.artist, count(*)::bigint
  from public.songs s
  cross join lateral unnest(s.artist) as u(artist)
  where u.artist <> 'Unknown Artist'
  group by u.artist
  order by count(*) desc, u.artist asc
$$;

revoke execute on function public.artist_song_counts() from public;
grant execute on function public.artist_song_counts() to anon, authenticated, service_role;
