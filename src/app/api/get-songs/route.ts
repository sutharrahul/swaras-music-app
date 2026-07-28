import { ApiResponse } from '@/app/utils/ApiResponse';
import { parsePagination, privateNoStore, respondToDbError, validationMessage } from '@/lib/api';
import { SONG_COLUMNS, toSongDtos } from '@/lib/dto';
import { createClient } from '@/utils/supabase/server';

/**
 * The public catalogue.
 *
 * BUG 5 — closed, but NOT by deleting the route. The brief said to remove it on
 * the grounds that nothing reads it; that is no longer true. It is the only
 * catalogue endpoint the app has: `src/app/page.tsx` paginates it for the home
 * screen and `SongContextProvider` falls back to it four times to resolve the
 * player queue. Deleting it would leave the app with no songs. The two actual
 * defects are fixed instead:
 *
 *   1. It embedded `uploadedBy: { id, email, firstName, lastName }`. Every
 *      uploader is an admin, so an anonymous visitor was handed the admin roster
 *      and their email addresses. `SONG_COLUMNS` lists columns explicitly and
 *      contains no join onto `users` and no `uploaded_by_user_id`.
 *   2. `parseInt(limit)` was unclamped, so `?limit=999999` dumped the table.
 *      `parsePagination` caps it at 100 and rejects junk with a 400 instead of
 *      silently becoming NaN.
 *
 * Anonymous access works because `songs_select_public` grants SELECT on `songs`
 * to `anon`.
 *
 * Anonymous visitors get working `audioUrl`s here, not nulls. Browsing AND
 * listening are public, as they were when the media sat on Cloudinary; the
 * private bucket buys expiry and server-controlled issuance, not secrecy (see
 * `src/lib/storage.server.ts`).
 *
 * R7 — this became `private, no-store` when the audio moved to a private Storage
 * bucket, and that is not a nicety. The response now carries per-request signed
 * playback URLs with an expiry, so a shared cache would keep handing out a token
 * that is already part-spent. It was genuinely identical for everyone before; it
 * is not any more.
 */
export async function GET(request: Request) {
  const pagination = parsePagination(request.url);
  if (!pagination.success) {
    return ApiResponse.error(validationMessage(pagination.error), 400);
  }

  const { page, limit } = pagination.data;
  const from = (page - 1) * limit;

  const supabase = await createClient();

  const { data, count, error } = await supabase
    .from('songs')
    .select(SONG_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return respondToDbError(error, 'Failed to fetch songs');

  const songs = await toSongDtos(supabase, data ?? []);
  const total = count ?? 0;

  return privateNoStore(
    ApiResponse.success(
      'Songs fetched successfully',
      {
        songs,
        pagination: { page, limit, total, hasMore: from + songs.length < total },
      },
      200
    )
  );
}
