-- ---------------------------------------------------------------------------
-- Public like counts.
--
-- WHY THIS EXISTS
-- ---------------
-- `public.likes` is under `likes_owner_all`, an owner-only policy: a caller sees
-- only their own like rows. That is correct — who liked what is private — but it
-- means the obvious PostgREST embed, `songs?select=*,likes(count)`, counts only
-- the caller's own likes and renders 0 for everyone else. The UI has always
-- shown a global like count per song (`song._count.likes`), and the home page
-- ranks its "Most liked" shelf on it.
--
-- So: one SECURITY DEFINER function that returns nothing but (song_id, count).
-- The aggregate was already public through this app's own endpoints; the
-- individual like rows stay behind the owner-only policy. There is no way to ask
-- this function *who* liked a song.
--
-- SECURITY DEFINER hygiene, same as the helpers in the RLS migration:
--   * `search_path` is pinned to '' and every object is schema-qualified, so a
--     caller cannot shadow `public.likes` with an object in a schema they own.
--   * every reference to the `likes` column is qualified (`l.song_id`), so it
--     can never resolve to the function's own OUT column of the same name.
--   * the parameter is `p_song_ids`, deliberately not `song_ids`, for the same
--     reason.
--
-- The function is STABLE and takes the id list as an array, so a page of songs
-- costs exactly one round-trip.
-- ---------------------------------------------------------------------------

create or replace function public.song_like_counts(p_song_ids text[])
returns table (song_id text, like_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select l.song_id, count(*)::bigint
  from public.likes l
  where l.song_id = any(p_song_ids)
  group by l.song_id
$$;

revoke execute on function public.song_like_counts(text[]) from public;
grant execute on function public.song_like_counts(text[]) to anon, authenticated, service_role;
