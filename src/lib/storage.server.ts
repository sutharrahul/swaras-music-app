import 'server-only';

import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';

import type { Database, TablesInsert } from '@/lib/database.types';
import { AUDIO_BUCKET, AUDIO_URL_TTL_SECONDS, removeSongObjects } from '@/lib/storage';

/**
 * Signing playback URLs for the private `song-audio` bucket. SERVER ONLY.
 *
 * WHY THIS IS NOT IN `src/lib/storage.ts`
 * ---------------------------------------
 * The first cut let every signed-in caller read `song-audio` through their own
 * publishable-key client (`song_audio_select_authenticated`). That policy
 * authorizes the `/object/sign/` endpoint too, so any signed-in user could open
 * the browser console, `list()` the whole catalogue, `download()` it, and mint
 * their OWN signed URLs at any TTL to hand to anonymous third parties. The 6h
 * TTL constrained nobody, because the caller chose the TTL.
 *
 * The bucket now has no SELECT policy for ordinary users at all, so signing is
 * a capability only this module has, and it only ever signs the exact paths a
 * handler already read out of `songs` for that request.
 *
 * WHAT "PRIVATE BUCKET" ACTUALLY BUYS, HONESTLY
 * ---------------------------------------------
 * Not secrecy. `/` and `/api/get-songs` are public and anonymous visitors are
 * meant to listen (they could before Storage replaced Cloudinary), so this signs
 * for anonymous callers too and anyone willing to call the endpoint can reach
 * the audio. What is left is real but smaller than "private" suggests:
 *   * the SERVER decides when a URL is issued, and can stop issuing them;
 *   * every URL EXPIRES, so a link that leaks stops working, instead of an
 *     object URL being a permanent bearer token the way Cloudinary's was;
 *   * nobody but this module can enumerate the bucket or choose a TTL.
 * Do not write "only signed-in callers can stream" here again — that was the
 * previous comment, and it was false.
 *
 * `import 'server-only'` is the guard rail: if any module in a client component
 * graph ever imports this file, the build fails rather than shipping
 * `SUPABASE_SECRET_KEY` to the browser.
 */

let cached: SupabaseClient<Database> | null = null;

/**
 * The secret-key client. It BYPASSES RLS, so it is deliberately not exported —
 * the only thing this file offers is "sign these paths".
 *
 * A module-level singleton is safe here precisely because it carries no session:
 * there is no per-user state to leak between requests, which is the reason
 * `utils/supabase/server.ts` forbids one.
 */
function secretClient(): SupabaseClient<Database> {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set');
  }

  cached = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/**
 * Signed playback URLs for a page of songs, in ONE round-trip for the page.
 *
 * Once per listing, not once per play and certainly not once per range request.
 * A fresh token is always a CDN miss while the same token caches (measured:
 * MISS → HIT → HIT on a repeated token, MISS on a new one over the same object),
 * so re-signing per play would turn every seek into a cold origin fetch. That is
 * also why `AUDIO_URL_TTL_SECONDS` is hours: the one URL has to outlive the
 * listening session.
 *
 * Returns an empty map rather than throwing when signing fails: one missing
 * object (a half-finished upload) should not 500 a whole listing. The caller
 * surfaces the resulting null `audioUrl` as an error — it must not fail
 * silently, which is what the player used to do.
 */
export async function signAudioUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const { data, error } = await secretClient()
    .storage.from(AUDIO_BUCKET)
    .createSignedUrls(unique, AUDIO_URL_TTL_SECONDS);

  if (error || !data) {
    console.error('Failed to sign playback URLs:', error);
    return new Map();
  }

  const signed = new Map<string, string>();
  for (const entry of data) {
    // `path` echoes back what was asked for; `signedUrl` is null for the entries
    // that failed, and the array mixes successes and failures.
    if (entry.path && entry.signedUrl && !entry.error) signed.set(entry.path, entry.signedUrl);
  }
  return signed;
}

/**
 * Insert `upload_job_items` rows on the SECRET key rather than the caller's own
 * client. SERVER ONLY, and the reason is spelled out in
 * `supabase/migrations/..._upload_job_items_column_grants.sql`: this insert used
 * to run through the admin's own client, which meant `authenticated` needed table
 * INSERT — and Postgres cannot tell "the server inserting a row it just derived"
 * apart from "the browser inserting whatever it wants" when both arrive as the
 * same role and JWT. An admin could exploit that gap to insert an item of their
 * own with an arbitrary `audio_path` and have `/api/upload-song/complete`
 * register a song pointing at an object they never uploaded.
 *
 * Moving the insert here and revoking INSERT from `authenticated` (see the
 * migration this shipped with) closes it: only this module, never a caller's
 * JWT, can create an item row, and every row it creates is one this server just
 * derived the paths for in `POST /api/upload-song`.
 */
export async function insertUploadJobItems(
  rows: TablesInsert<'upload_job_items'>[]
): Promise<{ error: PostgrestError | null }> {
  const { error } = await secretClient().from('upload_job_items').insert(rows);
  return { error };
}

export type SweepResult = { jobsSwept: number; itemsFailed: number; objectsRemoved: number };

/**
 * Destroy the objects — and settle the rows — for upload jobs abandoned partway.
 * SERVER ONLY, runs on the secret key because it has no caller session: it is
 * meant to be invoked by a scheduler, not a signed-in admin's request.
 *
 * WHAT COUNTS AS "EXPIRED"
 * -------------------------
 * `upload_jobs.expires_at` is set at job creation (`POST /api/upload-song`,
 * `JOB_TTL_MS` = 24h) for exactly this: a job an admin abandons — closed the
 * tab, the browser crashed, the upload just never finished — is otherwise stuck
 * at `PROCESSING` forever, with no code path that ever revisits it. This sweeps
 * every job past that deadline that is still `PROCESSING`.
 *
 * WHAT THIS DOES AND DOES NOT CLEAN UP
 * -------------------------------------
 * For every non-COMPLETED item on an expired job, it removes whatever sits at
 * `audio_path` / `cover_path` (via `removeSongObjects`, which is idempotent —
 * nothing to remove is not an error) and marks the item FAILED. COMPLETED items
 * are never touched, expired job or not: they have a live `songs` row pointing
 * at that object.
 *
 * It does NOT reclaim an in-progress resumable (TUS) upload that was never
 * finalized. Measured directly (see the report this shipped with): an
 * interrupted multi-chunk upload leaves NO object visible to `list()` at all —
 * Storage does not expose a finalized object until the resumable session
 * completes — so there is nothing here for `.remove()` to find. The bytes
 * already sent still occupy the in-progress upload session server-side, and
 * only Supabase's own multipart-upload lifecycle (not exposed to this app)
 * can reclaim that. This sweep closes the DB-visible half of the leak (a job
 * stuck at PROCESSING, an item stuck at SIGNED) and removes any object that
 * WAS finalized but never registered — it does not, and cannot from here,
 * guarantee zero storage cost from a killed upload.
 *
 * Nothing currently calls this on a schedule. See the report for how to wire
 * it to Vercel Cron.
 */
export async function sweepExpiredUploadJobs(): Promise<SweepResult> {
  const client = secretClient();

  const { data: jobs, error: jobsError } = await client
    .from('upload_jobs')
    .select('id')
    .eq('status', 'PROCESSING')
    .lt('expires_at', new Date().toISOString());

  if (jobsError) {
    console.error('Failed to list expired upload jobs:', jobsError);
    return { jobsSwept: 0, itemsFailed: 0, objectsRemoved: 0 };
  }
  if (!jobs || jobs.length === 0) return { jobsSwept: 0, itemsFailed: 0, objectsRemoved: 0 };

  let itemsFailed = 0;
  let objectsRemoved = 0;

  for (const job of jobs) {
    const { data: items, error: itemsError } = await client
      .from('upload_job_items')
      .select('id, status, audio_path, cover_path, song_id')
      .eq('job_id', job.id);

    if (itemsError) {
      console.error(`Failed to list items for expired job ${job.id}:`, itemsError);
      continue;
    }

    for (const item of items ?? []) {
      // A COMPLETED item (or one that somehow acquired a song_id) already has a
      // live `songs` row pointing at these objects. Never remove those, no
      // matter how the parent job's status looks.
      if (item.status === 'COMPLETED' || item.song_id) continue;

      const removed = await removeSongObjects(client, {
        audioPath: item.audio_path,
        coverPath: item.cover_path,
      });
      if (removed) {
        objectsRemoved += [item.audio_path, item.cover_path].filter(Boolean).length;
      }

      const { error: updateError } = await client
        .from('upload_job_items')
        .update({ status: 'FAILED', error_code: 'JOB_EXPIRED' })
        .eq('id', item.id);

      if (updateError) console.error(`Failed to mark item ${item.id} FAILED on sweep:`, updateError);
      else itemsFailed++;
    }

    const { error: closeError } = await client
      .from('upload_jobs')
      .update({ status: 'EXPIRED' })
      .eq('id', job.id);

    if (closeError) console.error(`Failed to mark job ${job.id} EXPIRED:`, closeError);
  }

  return { jobsSwept: jobs.length, itemsFailed, objectsRemoved };
}
