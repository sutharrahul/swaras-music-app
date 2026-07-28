import { ApiResponse } from '@/app/utils/ApiResponse';
import { parsePagination, privateNoStore, respondToDbError, validationMessage } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { SONG_COLUMNS, toSongDtos } from '@/lib/dto';

/**
 * BUG 3 — closed.
 *
 * This took `?userId=` from the query string with no auth whatsoever, so any
 * visitor could read any user's liked songs by guessing an id — and bug 6 handed
 * those ids out. The set now comes from the session and nothing else.
 *
 * It also embedded `uploadedBy: { id, email, … }` on every song, which published
 * admin email addresses; `SONG_COLUMNS` has no join onto `users` at all.
 */
export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const pagination = parsePagination(request.url);
  if (!pagination.success) {
    return ApiResponse.error(validationMessage(pagination.error), 400);
  }

  const { page, limit } = pagination.data;
  const from = (page - 1) * limit;

  // One round-trip: the embedded `songs` join follows the FK, and `count:
  // 'exact'` gives the total without a second query. RLS on `likes` already
  // restricts this to the caller; the explicit `user_id` filter states it.
  const { data, count, error } = await auth.supabase
    .from('likes')
    .select(`created_at, songs!inner(${SONG_COLUMNS})`, { count: 'exact' })
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) return respondToDbError(error, 'Failed to fetch liked songs');

  const rows = (data ?? []).map(like => like.songs);
  const songs = await toSongDtos(auth.supabase, rows);
  const total = count ?? 0;

  return privateNoStore(
    ApiResponse.success(
      'Liked songs fetched successfully',
      {
        songs,
        pagination: { page, limit, total, hasMore: from + songs.length < total },
      },
      200
    )
  );
}
