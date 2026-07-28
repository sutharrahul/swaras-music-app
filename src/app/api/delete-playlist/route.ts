import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { z } from 'zod';

const bodySchema = z.object({
  playlistId: z.string().min(1),
});

/**
 * Delete one of the caller's own playlists.
 *
 * This duplicates `DELETE /api/playlists/[playlistId]`, which is the RESTful
 * spelling and the one the playlists page uses. It is kept because
 * `usePlaylistApi.deletePlaylist` still calls it and collapsing the two is
 * frontend consolidation (task #14), not part of the auth migration.
 */
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

  const { data, error } = await auth.supabase
    .from('playlists')
    .delete()
    .eq('id', parsed.data.playlistId)
    .eq('user_id', auth.user.id)
    .select('id');

  if (error) return respondToDbError(error, 'Failed to delete playlist');
  if (!data || data.length === 0) return ApiResponse.error('Playlist not found', 404);

  return ApiResponse.success('Playlist deleted successfully', { id: parsed.data.playlistId }, 200);
}
