import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { z } from 'zod';

const bodySchema = z.object({
  playlistId: z.string().min(1),
  songId: z.string().min(1),
});

/** Remove a song from one of the caller's own playlists. */
export async function DELETE(request: Request) {
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

  const { data: playlist, error: playlistError } = await supabase
    .from('playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (playlistError) return respondToDbError(playlistError, 'Failed to remove song from playlist');
  if (!playlist) return ApiResponse.error('Playlist not found', 404);

  const { data, error } = await supabase
    .from('playlist_songs')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('song_id', songId)
    .select('id');

  if (error) return respondToDbError(error, 'Failed to remove song from playlist');
  if (!data || data.length === 0) return ApiResponse.error('Song not found in playlist', 404);

  return ApiResponse.success(
    'Song removed from playlist successfully',
    { playlistId, songId },
    200
  );
}
