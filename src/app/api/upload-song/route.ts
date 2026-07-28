import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import {
  ALLOWED_AUDIO_TYPES,
  ALLOWED_COVER_TYPES,
  AUDIO_BUCKET,
  COVER_BUCKET,
  MAX_AUDIO_BYTES,
  MAX_FILES_PER_JOB,
  TUS_CHUNK_SIZE,
  assetPaths,
} from '@/lib/storage';
import { randomUUID } from 'crypto';
import { z } from 'zod';

/**
 * Start an upload job. NO FILE BYTES PASS THROUGH HERE.
 *
 * The old handler took the whole `multipart/form-data` payload, buffered every
 * file in the function, and pushed each one to Cloudinary. That is unshippable
 * on Vercel twice over: the request body limit is ~4.5MB, so a single 100MB
 * track never even arrived, and the "background" pass it kicked off outlived the
 * response, which a serverless function is free to freeze the moment it
 * responds. Both problems disappear if the bytes never come here — the browser
 * uploads straight to Storage over TUS and this endpoint only mints the job.
 *
 * What it mints is the security boundary. The client sends a MANIFEST (names,
 * sizes, content types) and gets back object paths that the SERVER derived from
 * ids it generated. A client-supplied path would let an admin write anywhere in
 * the bucket and, worse, let the completion step register a `songs` row pointing
 * at an object it never uploaded. `upload_job_items.audio_path` is the record of
 * what was authorized, and `/api/upload-song/complete` re-reads it from there
 * rather than believing the caller.
 *
 * The manifest is untrusted input, so the sizes are bounded here as well as by
 * the bucket's own `file_size_limit` — this check produces a useful 400 before a
 * 100MB upload starts, the bucket limit is the one that cannot be bypassed.
 *
 * R1: `user_id` is `auth.user.id` from the verified session. `upload_jobs` is
 * additionally under `upload_jobs_owner_all`, which requires ownership AND a
 * live ADMIN role, so one admin cannot see or drive another's job.
 */

const JOB_TTL_MS = 24 * 60 * 60 * 1000;

const manifestSchema = z.object({
  items: z
    .array(
      z.object({
        originalName: z.string().trim().min(1).max(255),
        size: z.number().int().min(1).max(MAX_AUDIO_BYTES),
        contentType: z.enum(ALLOWED_AUDIO_TYPES),
        // No cover size: nothing would consume it, and `song-covers` has its
        // own file_size_limit, which is the check a client cannot lie past.
        coverContentType: z.enum(ALLOWED_COVER_TYPES).optional(),
      })
    )
    .min(1, 'Select at least one file')
    .max(MAX_FILES_PER_JOB, `At most ${MAX_FILES_PER_JOB} files per upload`),
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

  const parsed = manifestSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(validationMessage(parsed.error), 400);
  }

  const { supabase, user } = auth;
  const { items } = parsed.data;

  const jobId = randomUUID();

  const { error: jobError } = await supabase.from('upload_jobs').insert({
    id: jobId,
    user_id: user.id,
    total_items: items.length,
    status: 'PROCESSING',
    // A job the admin abandons leaves objects in the bucket with no `songs` row
    // pointing at them. `expires_at` is what a sweep would key off to find and
    // destroy them. NOTE: that sweep does not exist yet — see the report.
    expires_at: new Date(Date.now() + JOB_TTL_MS).toISOString(),
  });

  if (jobError) return respondToDbError(jobError, 'Failed to start the upload');

  // Order matters: the client pairs its own files with these by index, so the
  // response must stay in manifest order.
  const rows = items.map(item => {
    const itemId = randomUUID();
    const paths = assetPaths(jobId, itemId, item.contentType, item.coverContentType);

    return {
      id: itemId,
      job_id: jobId,
      original_name: item.originalName,
      asset_prefix: paths.prefix,
      total_bytes: item.size,
      chunk_size: TUS_CHUNK_SIZE,
      audio_path: paths.audioPath,
      cover_path: paths.coverPath,
    };
  });

  const { error: itemsError } = await supabase.from('upload_job_items').insert(rows);

  if (itemsError) {
    // Nothing has been uploaded yet, so dropping the job leaves no orphan —
    // this is the one point in the flow where a clean rollback is possible.
    await supabase.from('upload_jobs').delete().eq('id', jobId);
    return respondToDbError(itemsError, 'Failed to start the upload');
  }

  return ApiResponse.success(
    'Upload job created',
    {
      jobId,
      chunkSize: TUS_CHUNK_SIZE,
      audioBucket: AUDIO_BUCKET,
      coverBucket: COVER_BUCKET,
      items: rows.map(row => ({
        id: row.id,
        originalName: row.original_name,
        audioPath: row.audio_path,
        coverPath: row.cover_path,
      })),
    },
    201
  );
}
