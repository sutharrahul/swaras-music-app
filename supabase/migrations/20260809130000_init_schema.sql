-- ---------------------------------------------------------------------------
-- Swaras — baseline schema.
--
-- This is a *clean, complete* schema, not a diff. It is the SQL translation of
-- the (now deleted) prisma/schema.prisma, with two deliberate substitutions:
--
--   1. The Clerk linkage on `users` (vendor_id / vendor_name / vendor_data) is
--      replaced by `supabase_user_id uuid unique references auth.users(id)`.
--   2. The Cloudinary asset ids (`*_public_id`) are replaced by Supabase
--      Storage object paths (`audio_path` / `cover_path`).
--
-- SAFETY AGAINST AN EXISTING DATABASE
-- -----------------------------------
-- Every statement here is `IF NOT EXISTS`-guarded, so running it twice is
-- harmless. That is NOT the same as being correct against a database that
-- already carries the old Prisma tables: `CREATE TABLE IF NOT EXISTS` silently
-- does nothing when the table exists, so an old `users` table would keep
-- `vendor_id`/`vendor_name`/`vendor_data` and would never gain
-- `supabase_user_id`, and an old `songs` table would keep `audio_public_id`
-- rather than gaining `audio_path`. The result would be a database that this
-- repo's TypeScript types describe incorrectly.
--
-- Verified against a throwaway Postgres 15 loaded with the four old Prisma
-- migrations: this file reports success while changing nothing on the existing
-- tables, and the RLS migration that follows then aborts with
-- `column u.supabase_user_id does not exist` — leaving a half-migrated database.
--
-- Run this only against a database that does NOT already have these tables.
-- If one does, the operator must first drop them (there is no production data
-- to preserve — see the project notes) or hand-write the ALTER path.
--
-- Types deliberately kept identical to what Prisma emitted, so this schema is
-- comparable to the four migrations in the old prisma/migrations/ folder:
--   * primary keys are `text` holding a uuid, not `uuid`
--   * timestamps are `timestamp(3)` (without time zone), not `timestamptz`
--   * `users."firstName"` / `users."lastName"` keep their camelCase quoting
-- ---------------------------------------------------------------------------

-- --------------------------------------------------------------------------
-- Enums
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'UserRole') then
    create type "UserRole" as enum ('USER', 'ADMIN');
  end if;
  if not exists (select 1 from pg_type where typname = 'UserStatus') then
    create type "UserStatus" as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');
  end if;
  if not exists (select 1 from pg_type where typname = 'SignupMethod') then
    create type "SignupMethod" as enum ('EMAIL', 'GOOGLE');
  end if;
  if not exists (select 1 from pg_type where typname = 'CreditRole') then
    create type "CreditRole" as enum (
      'PRIMARY_ARTIST', 'FEATURED_ARTIST', 'PRODUCER',
      'COMPOSER', 'LYRICIST', 'ARRANGER'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'AlbumType') then
    create type "AlbumType" as enum ('ALBUM', 'SINGLE', 'EP', 'COMPILATION', 'SOUNDTRACK');
  end if;
  if not exists (select 1 from pg_type where typname = 'UploadJobStatus') then
    create type "UploadJobStatus" as enum ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED');
  end if;
  if not exists (select 1 from pg_type where typname = 'UploadItemStatus') then
    create type "UploadItemStatus" as enum ('PENDING', 'SIGNED', 'UPLOADED', 'COMPLETED', 'FAILED');
  end if;
end
$$;

-- --------------------------------------------------------------------------
-- updated_at
--
-- Prisma's `@updatedAt` was applied by the client, so the old DDL emitted
-- `updated_at TIMESTAMP(3) NOT NULL` with no default and no trigger. supabase-js
-- speaks plain PostgREST and will not fill that column, so the guarantee has to
-- move into the database: a default for INSERT and a trigger for UPDATE.
-- --------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- users
--
-- `supabase_user_id` is the ONLY link to an auth identity. It is never matched
-- by email: attaching an auth identity to a pre-existing row that merely shares
-- an email address is an account-takeover primitive.
--
-- `on delete set null` (rather than cascade) because `songs.uploaded_by_user_id`
-- is ON DELETE RESTRICT: deleting an auth identity must never be able to take
-- the catalogue with it, and must never fail because of it either.
-- --------------------------------------------------------------------------
create table if not exists public.users (
  id                 text primary key default gen_random_uuid()::text,
  email              text not null,
  "firstName"        text,
  "lastName"         text,
  role               "UserRole" not null default 'USER',
  status             "UserStatus" not null default 'ACTIVE',
  profile_image_url  text,
  signup_method      "SignupMethod" not null default 'EMAIL',
  supabase_user_id   uuid unique references auth.users (id) on delete set null,
  created_at         timestamp(3) not null default now(),
  updated_at         timestamp(3) not null default now()
);

create unique index if not exists users_email_key on public.users (email);

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- artists / albums / movies
--
-- Catalogue metadata. No write path exists anywhere in the app today; these are
-- schema-only, carried over so the future song_credits work has somewhere to
-- land.
-- --------------------------------------------------------------------------
create table if not exists public.artists (
  id         text primary key default gen_random_uuid()::text,
  name       text not null,
  bio        text,
  image_url  text,
  country    text,
  created_at timestamp(3) not null default now(),
  updated_at timestamp(3) not null default now()
);

create unique index if not exists artists_name_key on public.artists (name);
create index if not exists artists_name_idx on public.artists (name);

drop trigger if exists artists_set_updated_at on public.artists;
create trigger artists_set_updated_at
  before update on public.artists
  for each row execute function public.set_updated_at();

create table if not exists public.albums (
  id           text primary key default gen_random_uuid()::text,
  title        text not null,
  type         "AlbumType" not null default 'ALBUM',
  release_year integer,
  cover_url    text,
  created_at   timestamp(3) not null default now(),
  updated_at   timestamp(3) not null default now()
);

create index if not exists albums_title_idx on public.albums (title);
create index if not exists albums_type_idx on public.albums (type);

drop trigger if exists albums_set_updated_at on public.albums;
create trigger albums_set_updated_at
  before update on public.albums
  for each row execute function public.set_updated_at();

create table if not exists public.movies (
  id           text primary key default gen_random_uuid()::text,
  title        text not null,
  release_year integer,
  poster_url   text,
  created_at   timestamp(3) not null default now(),
  updated_at   timestamp(3) not null default now()
);

create unique index if not exists movies_title_key on public.movies (title);
create index if not exists movies_title_idx on public.movies (title);

drop trigger if exists movies_set_updated_at on public.movies;
create trigger movies_set_updated_at
  before update on public.movies
  for each row execute function public.set_updated_at();

-- Prisma modelled Album <-> Artist as an implicit many-to-many, which it
-- materialised as a table literally named `_AlbumArtist` with columns "A"/"B".
-- Nothing outside Prisma can read that intelligibly, so it becomes an explicit
-- join table. Same shape, same cascade behaviour.
create table if not exists public.album_artists (
  album_id  text not null references public.albums (id) on delete cascade on update cascade,
  artist_id text not null references public.artists (id) on delete cascade on update cascade,
  primary key (album_id, artist_id)
);

create index if not exists album_artists_artist_id_idx on public.album_artists (artist_id);

-- --------------------------------------------------------------------------
-- songs
--
-- `uploaded_by_user_id` is ON DELETE RESTRICT, NOT cascade. Every song is
-- uploaded by an admin, so a cascading delete on that user would take the whole
-- catalogue with it. Deactivate users (status = 'INACTIVE') instead of deleting
-- the row.
--
-- `artist` / `composers` are declared NOT NULL DEFAULT '{}' even though Prisma's
-- emitted DDL left scalar list columns nullable — the Prisma client treated them
-- as required, and the UI joins them without a null check.
-- --------------------------------------------------------------------------
create table if not exists public.songs (
  id                  text primary key default gen_random_uuid()::text,
  title               text not null,
  duration            integer not null,
  audio_url           text not null,
  uploaded_by_user_id text not null references public.users (id) on delete restrict on update cascade,
  artist              text[] not null default '{}',
  composers           text[] not null default '{}',
  album               text,
  genre               text,
  cover_url           text,
  lyrics              text,
  -- Supabase Storage object paths, captured at upload time. Replaces the
  -- Cloudinary audio_public_id / cover_public_id columns. Nullable because rows
  -- written before the Storage cutover have only a URL.
  audio_path          text,
  cover_path          text,
  album_id            text references public.albums (id) on delete set null on update cascade,
  movie_id            text references public.movies (id) on delete set null on update cascade,
  created_at          timestamp(3) not null default now(),
  updated_at          timestamp(3) not null default now()
);

create index if not exists songs_uploaded_by_user_id_idx on public.songs (uploaded_by_user_id);
create index if not exists songs_title_idx on public.songs (title);
create index if not exists songs_genre_idx on public.songs (genre);
create index if not exists songs_album_id_idx on public.songs (album_id);
create index if not exists songs_movie_id_idx on public.songs (movie_id);

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

-- Same artist can hold multiple roles on the same song, hence role in the PK.
create table if not exists public.song_credits (
  song_id   text not null references public.songs (id) on delete cascade on update cascade,
  artist_id text not null references public.artists (id) on delete cascade on update cascade,
  role      "CreditRole" not null,
  primary key (song_id, artist_id, role)
);

create index if not exists song_credits_artist_id_idx on public.song_credits (artist_id);
create index if not exists song_credits_role_idx on public.song_credits (role);

-- --------------------------------------------------------------------------
-- playlists / playlist_songs / likes
-- --------------------------------------------------------------------------
create table if not exists public.playlists (
  id          text primary key default gen_random_uuid()::text,
  user_id     text not null references public.users (id) on delete cascade on update cascade,
  name        text not null,
  description text,
  created_at  timestamp(3) not null default now(),
  updated_at  timestamp(3) not null default now()
);

create index if not exists playlists_user_id_idx on public.playlists (user_id);

drop trigger if exists playlists_set_updated_at on public.playlists;
create trigger playlists_set_updated_at
  before update on public.playlists
  for each row execute function public.set_updated_at();

create table if not exists public.playlist_songs (
  id          text primary key default gen_random_uuid()::text,
  playlist_id text not null references public.playlists (id) on delete cascade on update cascade,
  song_id     text not null references public.songs (id) on delete cascade on update cascade,
  position    integer,
  added_at    timestamp(3) not null default now()
);

create unique index if not exists playlist_songs_playlist_id_song_id_key
  on public.playlist_songs (playlist_id, song_id);
create index if not exists playlist_songs_playlist_id_idx on public.playlist_songs (playlist_id);
create index if not exists playlist_songs_song_id_idx on public.playlist_songs (song_id);

create table if not exists public.likes (
  id         text primary key default gen_random_uuid()::text,
  user_id    text not null references public.users (id) on delete cascade on update cascade,
  song_id    text not null references public.songs (id) on delete cascade on update cascade,
  created_at timestamp(3) not null default now()
);

create unique index if not exists likes_user_id_song_id_key on public.likes (user_id, song_id);
create index if not exists likes_user_id_idx on public.likes (user_id);
create index if not exists likes_song_id_idx on public.likes (song_id);

-- --------------------------------------------------------------------------
-- Upload pipeline
--
-- Jobs live in Postgres so status survives a restart and so one admin cannot
-- poll another admin's job. Files go straight from the browser to Storage in
-- chunks, so the API never sees the bytes; `uploaded_bytes` is our own resume
-- offset because the storage backend exposes no "how much have you received"
-- endpoint.
-- --------------------------------------------------------------------------
create table if not exists public.upload_jobs (
  id          text primary key default gen_random_uuid()::text,
  user_id     text not null references public.users (id) on delete cascade on update cascade,
  status      "UploadJobStatus" not null default 'PENDING',
  total_items integer not null,
  -- Stale jobs past this point are swept: marked EXPIRED and their partial
  -- objects destroyed. Without it, an admin closing the tab mid-upload leaks
  -- a stored object forever.
  expires_at  timestamp(3) not null,
  created_at  timestamp(3) not null default now(),
  updated_at  timestamp(3) not null default now()
);

create index if not exists upload_jobs_user_id_created_at_idx on public.upload_jobs (user_id, created_at);
create index if not exists upload_jobs_status_expires_at_idx on public.upload_jobs (status, expires_at);

drop trigger if exists upload_jobs_set_updated_at on public.upload_jobs;
create trigger upload_jobs_set_updated_at
  before update on public.upload_jobs
  for each row execute function public.set_updated_at();

create table if not exists public.upload_job_items (
  id                text primary key default gen_random_uuid()::text,
  job_id            text not null references public.upload_jobs (id) on delete cascade on update cascade,
  status            "UploadItemStatus" not null default 'PENDING',
  original_name     text not null,
  -- The only Storage object-path prefix this item may claim. The server derives
  -- and signs it; the client never supplies one. On completion the returned path
  -- must match exactly, so a signature cannot be reused to register an
  -- unrelated object.
  asset_prefix      text not null,
  upload_session_id text not null,
  total_bytes       integer not null,
  uploaded_bytes    integer not null default 0,
  chunk_size        integer not null,
  audio_path        text,
  audio_url         text,
  cover_path        text,
  cover_url         text,
  song_id           text references public.songs (id) on delete set null on update cascade,
  -- Machine-readable code (e.g. STORAGE_OBJECT_MISSING), never a raw exception
  -- message.
  error_code        text,
  signed_at         timestamp(3),
  completed_at      timestamp(3),
  created_at        timestamp(3) not null default now(),
  updated_at        timestamp(3) not null default now()
);

create unique index if not exists upload_job_items_song_id_key on public.upload_job_items (song_id);
create index if not exists upload_job_items_job_id_idx on public.upload_job_items (job_id);
create index if not exists upload_job_items_status_idx on public.upload_job_items (status);

drop trigger if exists upload_job_items_set_updated_at on public.upload_job_items;
create trigger upload_job_items_set_updated_at
  before update on public.upload_job_items
  for each row execute function public.set_updated_at();

-- --------------------------------------------------------------------------
-- webhook_events
--
-- Idempotency ledger for at-least-once webhook delivery: recording the provider
-- event id makes a replay a no-op instead of a duplicate write.
-- --------------------------------------------------------------------------
create table if not exists public.webhook_events (
  svix_id     text primary key,
  event_type  text not null,
  received_at timestamp(3) not null default now()
);

create index if not exists webhook_events_received_at_idx on public.webhook_events (received_at);
