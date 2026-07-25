-- ---------------------------------------------------------------------------
-- Supabase Storage: buckets, object policies, and the columns that point at them.
--
-- This replaces Cloudinary. Two buckets, and they are DELIBERATELY NOT THE SAME
-- KIND -- see the justification below, because getting this wrong either breaks
-- audio seeking or breaks the Next.js image optimizer.
--
-- ORDERING NOTE: the `set not null` on songs.audio_path is first on purpose. On
-- a database that already holds Cloudinary-era rows it aborts the whole
-- migration (which the CLI runs in one transaction) BEFORE the `drop column`s
-- discard those Cloudinary URLs. Fail loudly rather than silently destroy the
-- only pointer to the old assets. If that abort is what you are reading in the
-- CLI output: those rows have no Storage object behind them, so decide
-- explicitly -- re-upload them, or delete them -- and re-run.
--
-- PRIVILEGE CAVEAT, UNVERIFIED: `storage.objects` is owned by
-- `supabase_storage_admin`, and CREATE POLICY requires table ownership. On most
-- Supabase projects the `postgres` role the CLI connects as is a member of that
-- role and section 3 applies cleanly; on some it does not, and `db push` fails
-- with `must be owner of relation objects`. No project was reachable to settle
-- which applies here. If that is the error: create the four-per-bucket policies
-- from Dashboard -> Storage -> Policies with the same predicates, and keep the
-- rest of this file. Sections 1 and 2 are unaffected either way.
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- 1. songs / upload_job_items: the object PATH is the source of truth
--
-- `audio_url` and `cover_url` held absolute Cloudinary delivery URLs. A URL is
-- the wrong thing to persist now: the audio URL is short-lived (it is signed per
-- request, see below) and the cover URL is a pure function of the path. Storing
-- either would guarantee they drift. The wire DTO still exposes `audioUrl` /
-- `coverUrl`; both are now derived in `src/lib/storage.ts`.
-- ---------------------------------------------------------------------------
alter table public.songs alter column audio_path set not null;

alter table public.songs drop column if exists audio_url;
alter table public.songs drop column if exists cover_url;

alter table public.upload_job_items drop column if exists audio_url;
alter table public.upload_job_items drop column if exists cover_url;

-- `upload_session_id` is the resumable (TUS) upload URL, and Storage only mints
-- it when the BROWSER creates the upload -- which is the whole point: the bytes
-- never touch a Vercel function, so the server cannot know the session id at the
-- moment it inserts the item row. NOT NULL could therefore only be satisfied by
-- a placeholder meaning "no session yet", which is what NULL already means. The
-- browser fills it in through its own RLS-scoped update once tus hands it over,
-- and that is what makes a retry resume instead of restart.
alter table public.upload_job_items alter column upload_session_id drop not null;


-- ---------------------------------------------------------------------------
-- 2. Buckets
--
-- WHY `song-audio` IS PRIVATE AND `song-covers` IS PUBLIC
-- ------------------------------------------------------
-- A public bucket means a PERMANENT unauthenticated URL: once anybody has seen
-- it, it can be scraped or hotlinked forever. A private bucket plus signed URLs
-- replaces that permanent bearer token with an expiring one that only the server
-- can mint.
--
-- Be precise about what that does and does not buy, because the first version of
-- this comment overstated it and a reviewer caught it. `/` and `/api/get-songs`
-- are PUBLIC routes and anonymous visitors are meant to listen (they could
-- before this migration), so the server signs playback URLs for anonymous
-- callers too. The audio is therefore reachable by anyone willing to call the
-- endpoint. What is actually gained:
--   * URLs EXPIRE, so a leaked link dies;
--   * only the server can issue one, and only for paths it looked up, so
--     issuance can be rate-limited or stopped;
--   * nobody can enumerate the bucket or choose their own TTL.
-- What is NOT gained: secrecy of the audio itself.
--
-- The obvious objection is SEEKING. An <audio> element seeks by issuing a fresh
-- HTTP request with a `Range` header, and if the origin ignores Range the
-- browser can only play straight through. Supabase serves signed downloads
-- through the same object endpoint as public ones and honours `Range` on both,
-- so seeking works on a signed URL. What actually bites is EXPIRY, not Range: a
-- token that expires mid-session makes the *next* range request (i.e. the next
-- seek outside the buffered region) fail, even though playback of the buffered
-- part continues. That is why the TTL in `src/lib/storage.ts` is hours rather
-- than minutes, and why the catalogue endpoints that carry signed URLs are
-- `private, no-store` -- a cached page would hand out a token that is already
-- half spent.
--
-- The Range claim is now MEASURED, not inferred. Real `Range` requests against a
-- throwaway bucket returned 206 with a correct `content-range` on BOTH a public
-- and a signed URL, and `cf-cache-status` went MISS -> HIT -> HIT for a repeated
-- token while a fresh token over the same object was a MISS. So seeking works on
-- a signed URL, and the CDN cost is one cold fetch PER TOKEN rather than per
-- seek -- which is exactly why URLs are signed once per listing and reused. The
-- table is in docs/DEPLOYMENT.md section 1.1. Everything else in this file
-- (these buckets, these policies) is still unexercised: no Supabase project was
-- reachable to apply the migration against.
--
-- Cover art is public, and that is a deliberate split rather than an oversight:
--   * `next/image` fetches and caches the remote image server-side, keyed by the
--     src URL. A URL that changes on every render is a permanent cache miss, and
--     a cached entry whose URL has expired renders as a broken image. Signed
--     covers would quietly wreck the image pipeline.
--   * The covers are already published to anonymous visitors today -- `/` and
--     `/api/get-songs` and `/api/search` are all public routes that render album
--     art. Making the bucket private would protect nothing that is not already
--     out.
-- Anything genuinely sensitive must not go in `song-covers`.
--
-- `file_size_limit` here is a per-bucket cap. The PROJECT-level upload limit
-- (Settings -> Storage) is separate and lower by default on the free tier; a
-- 100MB bucket limit does nothing if the project cap is 50MB. Raise the project
-- cap or lower MAX_AUDIO_BYTES to match.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-audio',
  'song-audio',
  false,
  104857600, -- 100 MiB
  array[
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave',
    'audio/flac', 'audio/x-flac', 'audio/mp4', 'audio/m4a', 'audio/x-m4a',
    'audio/aac', 'audio/ogg'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-covers',
  'song-covers',
  true,
  10485760, -- 10 MiB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- ---------------------------------------------------------------------------
-- 3. storage.objects policies
--
-- `storage.objects` already has RLS enabled by Supabase; we only add policies,
-- and we do not touch the table's owner or its other policies. These run under
-- the caller's JWT exactly like the `public` schema ones, so `public.is_admin()`
-- is the same live `public.users.role` lookup used everywhere else (R5) -- never
-- a JWT claim, which would freeze at signup and survive a demotion.
--
-- No recursion risk here: `is_admin()` is SECURITY DEFINER over `public.users`
-- and these policies are on `storage.objects`, a different table entirely.
--
-- The resumable (TUS) upload path needs INSERT; a retry that re-sends an
-- already-created object needs UPDATE and SELECT. All three are admin-only, so
-- a signed-in non-admin holding a valid session still cannot write a single byte
-- into either bucket even if a route handler forgot to check.
-- ---------------------------------------------------------------------------

-- --- song-audio: NO read policy for ordinary users; write requires ADMIN ----
--
-- There was a `song_audio_select_authenticated` policy here granting SELECT on
-- the whole bucket to every signed-in user. It is gone, and it must not come
-- back. Storage's `/object/sign/` endpoint authorizes against the SELECT policy,
-- so that policy let any signed-in user (a) `list()` the entire catalogue and
-- `download()` it with the publishable key straight from the browser console,
-- and (b) mint their OWN signed URLs at ANY TTL and hand them to anonymous third
-- parties. The 6h TTL in src/lib/storage.ts constrained nobody, because the
-- caller picked the TTL.
--
-- Playback URLs are now signed exclusively by `src/lib/storage.server.ts`, which
-- is `server-only` and uses the SECRET key (which bypasses RLS by design), and
-- signs only the paths a handler already read out of `songs`. That is what makes
-- anonymous listening possible without a bucket-wide read policy.
--
-- Admins keep SELECT because the upload pipeline needs it: `objectSize()` in
-- /api/upload-song/complete `list()`s the object to verify it landed at the
-- declared size, and a resumed TUS upload reads back what is already there. An
-- admin can consequently sign their own URLs — accepted, since the same role can
-- already delete the catalogue outright.
drop policy if exists song_audio_select_authenticated on storage.objects;

drop policy if exists song_audio_select_admin on storage.objects;
create policy song_audio_select_admin on storage.objects
  for select to authenticated
  using (bucket_id = 'song-audio' and (select public.is_admin()));

drop policy if exists song_audio_insert_admin on storage.objects;
create policy song_audio_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'song-audio' and (select public.is_admin()));

drop policy if exists song_audio_update_admin on storage.objects;
create policy song_audio_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'song-audio' and (select public.is_admin()))
  with check (bucket_id = 'song-audio' and (select public.is_admin()));

drop policy if exists song_audio_delete_admin on storage.objects;
create policy song_audio_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'song-audio' and (select public.is_admin()));

-- --- song-covers: public bucket, but writes are still ADMIN-only ------------
-- `public = true` only bypasses authorization on the `/object/public/` read
-- path. Every write, and every read through the authenticated endpoint, still
-- goes through these.
drop policy if exists song_covers_select_public on storage.objects;
create policy song_covers_select_public on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'song-covers');

drop policy if exists song_covers_insert_admin on storage.objects;
create policy song_covers_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'song-covers' and (select public.is_admin()));

drop policy if exists song_covers_update_admin on storage.objects;
create policy song_covers_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'song-covers' and (select public.is_admin()))
  with check (bucket_id = 'song-covers' and (select public.is_admin()));

drop policy if exists song_covers_delete_admin on storage.objects;
create policy song_covers_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'song-covers' and (select public.is_admin()));
