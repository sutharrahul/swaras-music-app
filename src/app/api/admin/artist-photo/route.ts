import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import {
  ALLOWED_COVER_TYPES,
  ARTIST_IMAGE_BUCKET,
  artistImageUrl,
  artistPhotoPath,
  objectSize,
} from '@/lib/storage';
import { randomUUID } from 'crypto';
import { z } from 'zod';

/**
 * Artist photos, in two steps: POST mints a path, PATCH confirms the upload.
 *
 * Two steps for the same reason `/api/upload-song` is two steps — NO IMAGE
 * BYTES PASS THROUGH HERE. The browser uploads straight to Storage between the
 * two calls, authorized by its own access token against
 * `artist_images_insert_admin`. A photo is small enough to have proxied, but
 * proxying it would mean a second upload path to keep correct for no gain.
 *
 * THE SERVER MINTS THE PATH, and that is the security boundary rather than a
 * naming convention. Quoting the reasoning from `/api/upload-song`: a
 * client-supplied path would let an admin write anywhere in the bucket and,
 * worse, let the confirm step register a row pointing at an object it never
 * uploaded. Here both halves — the row that PATCH updates and the folder prefix
 * the object lives under — are derived from the same `artistId`, so they cannot
 * be decoupled: there is no request that updates one artist's row while writing
 * under another artist's prefix.
 *
 * Admin-only twice over. `requireAdmin()` reads the role live from
 * `public.users`, and `artists_write_admin` plus the `artist_images_*_admin`
 * Storage policies re-check it in the database, where a mistake in this file
 * cannot reach. The route is also absent from `PUBLIC_ROUTES`, so an anonymous
 * caller is refused by the middleware before any of this runs.
 */

/**
 * Both ids end up inside a bucket key, so what is validated is the CHARACTER
 * SET, not the format. Deliberately not `.uuid()`: `artists.id` is
 * `text primary key default gen_random_uuid()::text`, so the default is
 * UUID-shaped but a row seeded by hand from the Dashboard need not be, and a
 * format check would reject a perfectly good artist. The property that actually
 * matters is that the value cannot contain `/` or `.`, and so cannot walk out of
 * its own folder. `artistPhotoPath()` re-checks the same class as a last line of
 * defence.
 */
const ID = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * No declared size here, mirroring the cover branch of `/api/upload-song`:
 * nothing would consume it, and `artist-images` carries its own 10MiB
 * `file_size_limit`, which is the check a client cannot lie past.
 */
const mintSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    contentType: z.enum(ALLOWED_COVER_TYPES),
  })
  .strict();

const confirmSchema = z
  .object({
    artistId: ID,
    photoId: ID,
    contentType: z.enum(ALLOWED_COVER_TYPES),
  })
  .strict();

/**
 * Removal is keyed by `name`, not `artistId`, because that is what the caller
 * has: the artist list is derived from `songs.artist` and carries no row id (an
 * artist need not have an `artists` row at all). `name` is a real key here —
 * `artists_name_key` is unique.
 */
const removeSchema = z.object({ name: z.string().trim().min(1).max(200) }).strict();

/** Step 1 — find-or-create the artist row and hand back the path to upload to. */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400);
  }

  const parsed = mintSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(validationMessage(parsed.error), 400);
  }

  const { name, contentType } = parsed.data;

  // Find-or-create in a single statement. A select-then-insert would race two
  // admins opening the dialog for the same not-yet-profiled artist; the existing
  // unique index `artists_name_key` turns that race into an update of the very
  // same row rather than a 23505 for whoever lost it.
  const { data: artist, error } = await auth.supabase
    .from('artists')
    .upsert({ name }, { onConflict: 'name' })
    .select('id')
    .single();

  if (error) return respondToDbError(error, 'Failed to start the artist photo upload');

  // `artist.id` comes from the database, so zod never saw it — the `ID` schema
  // above only guards the two ids PATCH takes from a request body. A row seeded
  // by hand from the Dashboard could carry anything, and `artistPhotoPath()`
  // THROWS on a character outside its safe class, which would escape this
  // handler as a bare framework 500 rather than the `{ success, message }` shape
  // every other error here returns. Check it explicitly instead.
  const id = ID.safeParse(artist.id);
  if (!id.success) {
    console.error(`Artist ${artist.id} has an id that cannot be used as a storage path`);
    return ApiResponse.error('Failed to start the artist photo upload', 500);
  }

  // Fresh per upload, never a fixed `photo.jpg` — the cache reasoning is in
  // `artistPhotoPath()`.
  const photoId = randomUUID();

  return ApiResponse.success(
    'Artist photo upload started',
    {
      artistId: id.data,
      photoId,
      bucket: ARTIST_IMAGE_BUCKET,
      path: artistPhotoPath(id.data, photoId, contentType),
    },
    201
  );
}

/** Step 2 — point the row at the object the browser says it uploaded. */
export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400);
  }

  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(validationMessage(parsed.error), 400);
  }

  const { supabase } = auth;
  const { artistId, photoId, contentType } = parsed.data;

  // Re-derived from the same ids and the same function POST used, so the path is
  // never read out of the request body.
  const path = artistPhotoPath(artistId, photoId, contentType);

  // "I uploaded it" is a claim made by a browser, not a fact — the same
  // reasoning as `/api/upload-song/complete`. Without this, a request sent
  // before (or instead of) the upload would leave `image_path` pointing at
  // nothing and the artist card rendering a broken image. `objectSize()` LISTS
  // rather than downloads, so none of the image bytes come back through the
  // function; the `.list()` is authorized by `artist_images_select_public`.
  if ((await objectSize(supabase, ARTIST_IMAGE_BUCKET, path)) === null) {
    return ApiResponse.error('The photo was not found in storage', 409);
  }

  const { data: previous, error: readError } = await supabase
    .from('artists')
    .select('id, name, image_path')
    .eq('id', artistId)
    .maybeSingle();

  if (readError) return respondToDbError(readError, 'Failed to update the artist photo');
  if (!previous) return ApiResponse.error('Artist not found', 404);

  const { data: updated, error: updateError } = await supabase
    .from('artists')
    .update({ image_path: path })
    .eq('id', artistId)
    .select('name, image_path')
    .single();

  if (updateError) return respondToDbError(updateError, 'Failed to update the artist photo');

  // Only now, once the row already points at the new object. The ordering is the
  // whole argument: delete-first (or delete-on-failure) removes the image that is
  // still being served the moment the update does not land, and the artist loses
  // a photo they had. This way the worst case is an orphaned object nobody
  // references — invisible, and reclaimable later. So it is best-effort: log and
  // carry on, never fail a request that has already succeeded.
  if (previous.image_path && previous.image_path !== path) {
    const { error: removeError } = await supabase.storage
      .from(ARTIST_IMAGE_BUCKET)
      .remove([previous.image_path]);

    if (removeError) {
      console.error('Failed to remove the superseded artist photo:', removeError);
    }
  }

  return ApiResponse.success(
    'Artist photo updated',
    { artist: { name: updated.name, imageUrl: artistImageUrl(updated.image_path) } },
    200
  );
}

/** Clear an artist's photo: drop the pointer, then drop the bytes. */
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400);
  }

  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(validationMessage(parsed.error), 400);
  }

  const { supabase } = auth;
  const { name } = parsed.data;

  const { data: existing, error: readError } = await supabase
    .from('artists')
    .select('id, image_path')
    .eq('name', name)
    .maybeSingle();

  if (readError) return respondToDbError(readError, 'Failed to remove the artist photo');
  if (!existing) return ApiResponse.error('Artist not found', 404);

  // Idempotent by design: an artist with no photo is already in the state the
  // caller asked for, so this succeeds rather than 404/409-ing. That matters
  // because the button can be double-clicked, and because two admins can be
  // looking at the same list.
  if (!existing.image_path) {
    return ApiResponse.success('Artist photo removed', { artist: { name, imageUrl: null } }, 200);
  }

  // Pointer first, bytes second — the same ordering argument as the confirm step
  // above, pointing the same way. If the object delete fails we are left with an
  // orphan nothing references: invisible, and reclaimable later. Deleting the
  // object first and then failing to clear the column would leave every surface
  // (rail, grid, banner, this table) rendering a broken image instead.
  const { error: updateError } = await supabase
    .from('artists')
    .update({ image_path: null })
    .eq('id', existing.id);

  if (updateError) return respondToDbError(updateError, 'Failed to remove the artist photo');

  const { error: removeError } = await supabase.storage
    .from(ARTIST_IMAGE_BUCKET)
    .remove([existing.image_path]);

  // Best-effort: the row already says "no photo", so the request has succeeded
  // from the caller's point of view. Never fail it over the cleanup.
  if (removeError) {
    console.error('Failed to remove the artist photo object:', removeError);
  }

  return ApiResponse.success('Artist photo removed', { artist: { name, imageUrl: null } }, 200);
}
