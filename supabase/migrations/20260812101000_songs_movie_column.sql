-- --------------------------------------------------------------------------
-- songs.movie
--
-- A plain denormalized text field, matching the existing `album` / `genre`
-- columns on this table. The schema already carries a richer `movies` table
-- and `songs.movie_id` FK (see 20260809130000_init_schema.sql's "artists /
-- albums / movies" section) but that relational structure has no write path
-- anywhere in the app and is explicitly left unused for now — this column is
-- the simple, actually-used alternative for grouping songs by movie/soundtrack
-- name, the same way `album` already works.
-- --------------------------------------------------------------------------
alter table public.songs add column if not exists movie text;

create index if not exists songs_movie_idx on public.songs (movie);
