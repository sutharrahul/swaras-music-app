-- ---------------------------------------------------------------------------
-- Albums, derived the same way artists are.
--
-- `songs.album` is the source of truth — a plain text column, exactly like the
-- `artist` array is for `public.artist_song_counts()`. There is a richer
-- `public.albums` table in the original schema with a `songs.album_id` FK, but
-- it has no write path anywhere in the app and stays unused; see the note in
-- 20260812160000_artist_profiles.sql for the same reasoning about `artists`.
--
-- Two differences from the artist aggregate, both deliberate:
--
--   * `album` is a scalar, not an array, so there is no `unnest` and no
--     multi-value case. One song belongs to at most one album.
--   * The cover comes back with the counts. An album has no profile row and no
--     uploaded image of its own, so its artwork is simply the artwork of one of
--     its songs — the newest one that actually has any. Doing that here rather
--     than in a second query keeps it to one round-trip, and unlike the artist
--     photo there is no separate table it could drift out of sync with.
--
-- NULL and blank albums are excluded, not grouped into an "Unknown" bucket: a
-- song with no album does not belong to an album, and a card titled "" would be
-- unclickable anyway (the route segment would be empty).
-- ---------------------------------------------------------------------------
create or replace function public.album_song_counts()
returns table (album_name text, song_count bigint, cover_path text)
language sql
stable
set search_path = ''
as $$
  select
    s.album,
    count(*)::bigint,
    -- Newest song first, nulls stripped, take the first survivor. `array_remove`
    -- rather than `filter (where ...)` so an album whose newest song has no
    -- artwork still inherits the artwork of an older one instead of showing the
    -- placeholder.
    (array_remove(array_agg(s.cover_path order by s.created_at desc), null))[1]
  from public.songs s
  where s.album is not null
    and btrim(s.album) <> ''
  group by s.album
  order by count(*) desc, s.album asc
$$;

revoke execute on function public.album_song_counts() from public;
grant execute on function public.album_song_counts() to anon, authenticated, service_role;
