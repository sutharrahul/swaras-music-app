-- ---------------------------------------------------------------------------
-- The `artist-images` bucket.
--
-- PUBLIC, like `song-covers` and for the same reasons (see section 2 of
-- 20260809150000_storage.sql):
--   * next/image needs a STABLE src. A signed URL changes every render, which is
--     a permanent optimizer cache miss, and a cached entry whose URL has expired
--     renders as a broken image.
--   * next.config.ts pins `images.remotePatterns` to `/storage/v1/object/public/**`
--     on the Supabase host. A private bucket's signed path is NOT under that
--     prefix and next/image would refuse it outright. That pin is host-wide and
--     not bucket-scoped, so this new public bucket needs no config change.
--   * The photos are published to anonymous visitors by design — the home rail,
--     /artists and /artist/[name] are all public routes.
--
-- `public = true` bypasses authorization ONLY on the `/object/public/` READ
-- path. Every write still goes through the policies below.
--
-- A SEPARATE bucket rather than an `artists/` prefix inside `song-covers`: the
-- two have independent lifecycles (removeSongObjects / sweepExpiredUploadJobs
-- operate on song objects and would happily walk over anything sharing their
-- bucket), and one bucket per asset kind keeps the policy names readable.
--
-- PRIVILEGE CAVEAT — same as 20260809150000_storage.sql lines 16-23. CREATE
-- POLICY on `storage.objects` requires ownership of a table owned by
-- `supabase_storage_admin`. On some projects `db push` fails here with
-- `must be owner of relation objects`. If that happens: create the bucket and
-- these four policies from Dashboard -> Storage -> Policies with the same
-- predicates. The previous migration (column + function) is deliberately a
-- SEPARATE file so it still lands if this one cannot.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'artist-images',
  'artist-images',
  true,
  10485760, -- 10 MiB, same as song-covers
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- --- artist-images: public bucket, but writes are still ADMIN-only -----------
-- `artist_images_select_public` also covers the server's `objectSize()`
-- verification on the confirm step, which authorizes `.list()` against the
-- SELECT policy. That is why this bucket needs no separate `_select_admin`
-- policy the way `song-audio` does.
drop policy if exists artist_images_select_public on storage.objects;
create policy artist_images_select_public on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'artist-images');

drop policy if exists artist_images_insert_admin on storage.objects;
create policy artist_images_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artist-images' and (select public.is_admin()));

drop policy if exists artist_images_update_admin on storage.objects;
create policy artist_images_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'artist-images' and (select public.is_admin()))
  with check (bucket_id = 'artist-images' and (select public.is_admin()));

drop policy if exists artist_images_delete_admin on storage.objects;
create policy artist_images_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'artist-images' and (select public.is_admin()));
