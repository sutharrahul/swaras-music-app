/**
 * Supabase Storage: bucket names, object paths, and URL derivation.
 *
 * Isomorphic on purpose -- the admin upload page needs the same path rules the
 * server uses, and a second copy of them in the browser is how paths drift. It
 * imports nothing server-only and touches no secret: everything here works with
 * the publishable key and the caller's own session, so `storage.objects` RLS is
 * what actually authorizes each operation (R3).
 *
 * Signing playback URLs is NOT here, deliberately -- it needs the secret key and
 * lives in `storage.server.ts`, which is `server-only`.
 *
 * Two buckets, deliberately different kinds. The reasoning lives in
 * supabase/migrations/20260809150000_storage.sql; the short version is that
 * audio is private and signed per request, cover art is public so `next/image`
 * can cache it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';

export const AUDIO_BUCKET = 'song-audio';
export const COVER_BUCKET = 'song-covers';

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
export const MAX_COVER_BYTES = 10 * 1024 * 1024;

/** Items per job. Matches the limit the old form-data endpoint enforced. */
export const MAX_FILES_PER_JOB = 10;

/**
 * Supabase's resumable endpoint requires every chunk except the last to be
 * exactly 6MB. It is not a tunable -- a different value fails the upload.
 */
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024;

/**
 * The TUS endpoint the browser uploads to.
 *
 * This is why the whole flow is browser-driven: a Vercel function body is capped
 * around 4.5MB, so a 100MB track cannot be proxied through one at all. The bytes
 * go straight from the file input to Storage, authorized by the caller's own
 * access token against the `song_audio_insert_admin` policy.
 */
export function resumableUploadEndpoint(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`;
}

export const ALLOWED_AUDIO_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/flac',
  'audio/x-flac',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/ogg',
] as const;

export const ALLOWED_COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const AUDIO_EXTENSIONS: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/ogg': 'ogg',
};

const COVER_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * The object paths for one upload item.
 *
 * Derived from ids the SERVER minted, never from the uploaded filename. A
 * filename is attacker-controlled text: letting it into a path invites traversal
 * (`../`), collisions between two admins uploading `track.mp3`, and unicode
 * lookalikes. The original name is kept in `upload_job_items.original_name`
 * where it is only ever displayed.
 */
export function assetPaths(jobId: string, itemId: string, audioType: string, coverType?: string) {
  const prefix = `songs/${jobId}/${itemId}`;
  return {
    prefix,
    audioPath: `${prefix}/audio.${AUDIO_EXTENSIONS[audioType] ?? 'bin'}`,
    coverPath: coverType ? `${prefix}/cover.${COVER_EXTENSIONS[coverType] ?? 'jpg'}` : null,
  };
}

/**
 * `song-covers` is a public bucket, so this is a pure function of the path --
 * no round-trip, no expiry, stable enough for `next/image` to cache.
 */
export function coverUrl(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${COVER_BUCKET}/${path}`;
}

/**
 * How long a playback URL stays valid.
 *
 * Long, and that is the point: an <audio> element seeks by re-requesting the URL
 * with a `Range` header, so a token that expires mid-session breaks the next
 * seek even while the buffered audio keeps playing. Six hours comfortably
 * outlives a listening session.
 *
 * This IS meaningful as an access-control dial, unlike the first cut: signing
 * lives in `storage.server.ts` behind the secret key, so this constant is the
 * only TTL anyone can obtain. A caller cannot pick their own.
 */
export const AUDIO_URL_TTL_SECONDS = 6 * 60 * 60;

type Client = SupabaseClient<Database>;

/**
 * Remove a song's objects from both buckets.
 *
 * Resolves to `true` only when every object that was asked for is gone. The
 * caller uses that to decide whether it may delete the database row -- see the
 * ordering argument in `api/admin/delete-song`.
 *
 * `remove()` is idempotent: removing a path that is already absent is not an
 * error, which is what makes retrying a half-finished delete safe.
 */
export async function removeSongObjects(
  supabase: Client,
  paths: { audioPath?: string | null; coverPath?: string | null }
): Promise<boolean> {
  let ok = true;

  if (paths.audioPath) {
    const { error } = await supabase.storage.from(AUDIO_BUCKET).remove([paths.audioPath]);
    if (error) {
      console.error('Failed to remove audio object:', error);
      ok = false;
    }
  }

  if (paths.coverPath) {
    const { error } = await supabase.storage.from(COVER_BUCKET).remove([paths.coverPath]);
    if (error) {
      console.error('Failed to remove cover object:', error);
      ok = false;
    }
  }

  return ok;
}

/**
 * Confirm an object really landed, and at the size we were promised.
 *
 * The completion request comes from the browser, so "I uploaded it" is a claim,
 * not a fact. Without this an admin could register a `songs` row pointing at a
 * path that holds nothing, or at a 12-byte stub. `list` is used rather than
 * `download` so we never pull the file itself back through the function.
 */
export async function objectSize(
  supabase: Client,
  bucket: string,
  path: string
): Promise<number | null> {
  const slash = path.lastIndexOf('/');
  const folder = slash === -1 ? '' : path.slice(0, slash);
  const name = slash === -1 ? path : path.slice(slash + 1);

  const { data, error } = await supabase.storage.from(bucket).list(folder, { search: name });
  if (error || !data) return null;

  const match = data.find(entry => entry.name === name);
  if (!match) return null;

  const size = (match.metadata as { size?: number } | null)?.size;
  return typeof size === 'number' ? size : null;
}
