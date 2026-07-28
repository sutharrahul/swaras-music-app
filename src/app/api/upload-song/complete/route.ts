import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireAdmin, type ServerClient } from '@/lib/auth';
import { AUDIO_BUCKET, COVER_BUCKET, objectSize } from '@/lib/storage';
import { z } from 'zod';

/**
 * Register a finished upload as a `songs` row.
 *
 * Everything in the body is a CLAIM made by a browser, including "I uploaded
 * it". Two things make it safe to act on:
 *
 *   1. The paths are never taken from the request. They are read back out of
 *      `upload_job_items`, where this server wrote them when it created the job.
 *      The body carries only ids, so the worst a tampered request can do is name
 *      an item the caller does not own — and `upload_job_items_owner_all` makes
 *      that select return nothing.
 *   2. The object is verified to exist AND to be exactly the size the manifest
 *      declared. Without that check an admin could register a song whose audio
 *      is a 12-byte stub, or was never uploaded at all, and the catalogue would
 *      carry a permanently broken track.
 *
 * The ID3 metadata is the other untrusted half. It now comes from
 * `parseBlob` in the browser rather than `parseBuffer` on the server, which
 * means it is no longer read from a file this process controls — it is whatever
 * the client decided to send. Hence the bounds below: every string is length-
 * capped and every array is count-capped, so a crafted tag cannot write a
 * megabyte of text into the catalogue or a thousand-element artist array that
 * the UI then tries to render.
 */

const NAME_MAX = 200;
const PERSON_MAX = 120;

const metadataSchema = z.object({
  title: z.string().trim().min(1).max(NAME_MAX),
  artist: z.array(z.string().trim().min(1).max(PERSON_MAX)).max(10).default([]),
  composers: z.array(z.string().trim().min(1).max(PERSON_MAX)).max(20).default([]),
  album: z.string().trim().max(NAME_MAX).nullable().default(null),
  genre: z.string().trim().max(100).nullable().default(null),
  // 24h. Generous, but it is a sanity bound rather than a policy — the point is
  // that a negative or absurd value never reaches the column.
  duration: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60),
});

const bodySchema = z.object({
  jobId: z.string().min(1),
  itemId: z.string().min(1),
  metadata: metadataSchema,
});

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400);
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(validationMessage(parsed.error), 400);
  }

  const { supabase, user } = auth;
  const { jobId, itemId, metadata } = parsed.data;

  const { data: item, error: itemError } = await supabase
    .from('upload_job_items')
    .select('id, job_id, status, audio_path, cover_path, total_bytes, song_id')
    .eq('id', itemId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (itemError) return respondToDbError(itemError, 'Failed to finish the upload');
  if (!item) return ApiResponse.error('Upload item not found', 404);

  // Idempotent: a retried completion (double click, a response lost in flight)
  // must not insert the song twice. There is no unique constraint that would
  // catch it — two identical uploads are legitimately two rows.
  if (item.song_id) {
    return ApiResponse.success('Song already registered', { songId: item.song_id }, 200);
  }

  if (!item.audio_path) {
    await failItem(supabase, itemId, 'AUDIO_PATH_MISSING');
    return ApiResponse.error('This upload has no audio object', 409);
  }

  const audioSize = await objectSize(supabase, AUDIO_BUCKET, item.audio_path);

  if (audioSize === null) {
    await failItem(supabase, itemId, 'STORAGE_OBJECT_MISSING');
    return ApiResponse.error('The audio file was not found in storage', 409);
  }

  if (audioSize !== item.total_bytes) {
    await failItem(supabase, itemId, 'STORAGE_OBJECT_SIZE_MISMATCH');
    return ApiResponse.error('The uploaded audio is incomplete', 409);
  }

  // A missing cover is not worth failing the song over — the UI already falls
  // back to a placeholder image — so it degrades to "no cover" instead.
  let coverPath = item.cover_path;
  if (coverPath && (await objectSize(supabase, COVER_BUCKET, coverPath)) === null) {
    console.warn(`Cover object missing for upload item ${itemId}; registering the song without it`);
    coverPath = null;
  }

  const { data: song, error: insertError } = await supabase
    .from('songs')
    .insert({
      title: metadata.title,
      artist: metadata.artist.length > 0 ? metadata.artist : ['Unknown Artist'],
      composers: metadata.composers,
      album: metadata.album,
      genre: metadata.genre,
      duration: metadata.duration,
      audio_path: item.audio_path,
      cover_path: coverPath,
      // R1 — the uploader is the session user, never a field in the body.
      // `songs_write_admin` re-checks ADMIN on this INSERT regardless.
      uploaded_by_user_id: user.id,
    })
    .select('id, title')
    .single();

  if (insertError) {
    await failItem(supabase, itemId, 'SONG_INSERT_FAILED');
    return respondToDbError(insertError, 'Failed to finish the upload');
  }

  // The song row exists from here on. If this update fails the row is still
  // valid and playable; the item is simply left un-marked, and a retry hits the
  // `item.song_id` guard above only if it succeeded. That is the safe direction:
  // the alternative ordering can delete a song someone is already listening to.
  const { error: markError } = await supabase
    .from('upload_job_items')
    .update({ status: 'COMPLETED', song_id: song.id, completed_at: new Date().toISOString() })
    .eq('id', itemId);

  if (markError) {
    console.error('Song was created but the upload item could not be marked complete:', markError);
  }

  await closeJobIfDone(supabase, jobId);

  return ApiResponse.success('Song registered', { songId: song.id, title: song.title }, 201);
}

/** Record why an item stopped. `error_code` is a code, never an exception text. */
async function failItem(supabase: ServerClient, itemId: string, code: string) {
  const { error } = await supabase
    .from('upload_job_items')
    .update({ status: 'FAILED', error_code: code })
    .eq('id', itemId);

  if (error) console.error(`Failed to mark upload item ${itemId} as ${code}:`, error);
}

/**
 * Close the job once nothing is still in flight.
 *
 * FAILED counts as settled: a job stuck at PROCESSING because one item failed
 * would never be sweepable, and a partly-failed batch is still finished.
 */
async function closeJobIfDone(supabase: ServerClient, jobId: string) {
  const { count, error } = await supabase
    .from('upload_job_items')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .in('status', ['PENDING', 'SIGNED', 'UPLOADED']);

  if (error || count === null || count > 0) return;

  await supabase.from('upload_jobs').update({ status: 'COMPLETED' }).eq('id', jobId);
}
