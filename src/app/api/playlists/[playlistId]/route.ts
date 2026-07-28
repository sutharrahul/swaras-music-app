import { ApiResponse } from '@/app/utils/ApiResponse';
import { privateNoStore, respondToDbError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { SONG_COLUMNS, toSongDtos } from '@/lib/dto';

/**
 * One playlist and its songs.
 *
 * Ownership is enforced twice and neither check trusts the client. The explicit
 * `.eq('user_id', …)` states the intent at the call site, and
 * `playlists_owner_all` would filter the row out regardless.
 *
 * A playlist belonging to someone else comes back as 404, not 403. The old code
 * fetched the row first and *then* answered 403, which told the caller that the
 * id existed — an enumeration oracle over other people's playlists. "Not found"
 * is the honest answer to "a playlist you can see with this id": there isn't one.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { playlistId } = await params;

  const { data, error } = await auth.supabase
    .from('playlists')
    .select(
      `id, name, description, created_at, updated_at,
       playlist_songs(id, added_at, songs(${SONG_COLUMNS}))`
    )
    .eq('id', playlistId)
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error) return respondToDbError(error, 'Failed to fetch playlist');
  if (!data) return ApiResponse.error('Playlist not found', 404);

  // PostgREST cannot order an embedded resource by a parent-side expression, and
  // the row count here is one playlist's worth, so the sort is done in memory.
  const entries = [...data.playlist_songs].sort((a, b) => b.added_at.localeCompare(a.added_at));

  const songs = await toSongDtos(
    auth.supabase,
    entries.map(entry => entry.songs)
  );

  return privateNoStore(
    ApiResponse.success(
      'Playlist fetched successfully',
      {
        id: data.id,
        name: data.name,
        description: data.description,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        playlistSongs: entries.map((entry, index) => ({
          id: entry.id,
          addedAt: entry.added_at,
          song: songs[index],
        })),
      },
      200
    )
  );
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> }
) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { playlistId } = await params;

  // Deleting straight through the ownership filter removes the read-then-delete
  // gap and needs one round-trip instead of two. `select` reports whether the
  // filter actually matched, which is how 404 is told from success.
  const { data, error } = await auth.supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId)
    .eq('user_id', auth.user.id)
    .select('id');

  if (error) return respondToDbError(error, 'Failed to delete playlist');
  if (!data || data.length === 0) return ApiResponse.error('Playlist not found', 404);

  return ApiResponse.success('Playlist deleted successfully', { id: playlistId }, 200);
}
