import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/lib/database.types';
import { AUDIO_BUCKET, AUDIO_URL_TTL_SECONDS } from '@/lib/storage';

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
