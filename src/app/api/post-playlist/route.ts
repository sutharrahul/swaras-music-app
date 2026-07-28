import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { z } from 'zod';

const bodySchema = z.object({
  playlistId: z.string().min(1),
  songId: z.string().min(1),
});

/** Add a song to one of the caller's own playlists. */
export async function POST(request: Request) {
  const auth = await requireUser();
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

  const { playlistId, songId } = parsed.data;
  const { supabase } = auth;

  // The ownership check is `user_id = session user`, never a value from the
  // body. `playlist_songs_owner_all` re-checks the same thing on insert, so a
  // playlist id belonging to somebody else fails here and would fail there too.
  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (playlistError) return respondToDbError(playlistError, 'Failed to add song to playlist');
  if (!playlist) return ApiResponse.error('Playlist not found', 404);

  // `position` is append-at-the-end. This is read-then-write and two concurrent
  // adds can therefore land on the same position; that is cosmetic (the UI reads
  // `added_at`, and there is no unique index on position) and fixing it properly
  // needs a database-side default, which is not this task's file to change.
  const { data: last, error: positionError } = await supabase
    .from('playlist_songs')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (positionError) return respondToDbError(positionError, 'Failed to add song to playlist');

  const { data, error } = await supabase
    .from('playlist_songs')
    .insert({
      playlist_id: playlistId,
      song_id: songId,
      position: (last?.position ?? 0) + 1,
    })
    .select('id, playlist_id, song_id, position, added_at')
    .single();

  // 23505 → the (playlist_id, song_id) unique index: already in the playlist, so
  // 409. 23503 → the songs FK: no such song, so 404. Both used to be a 500.
  if (error) return respondToDbError(error, 'Failed to add song to playlist');

  return ApiResponse.success(
    'Song added to playlist',
    {
      id: data.id,
      playlistId: data.playlist_id,
      songId: data.song_id,
      position: data.position,
      addedAt: data.added_at,
    },
    201
  );
}
