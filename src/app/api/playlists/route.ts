import { ApiResponse } from '@/app/utils/ApiResponse';
import { privateNoStore, respondToDbError, validationMessage } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { PLAYLIST_COLUMNS, toPlaylistSummaryDto } from '@/lib/dto';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().trim().min(1, 'Playlist name is required').max(120),
  description: z.string().trim().max(500).optional().nullable(),
});

/**
 * The caller's own playlists.
 *
 * This is what `/api/get-playlist` should have been. That route took `?userId=`
 * and `?playlistId=` from the query with no auth and leaked the owner's email;
 * it is deleted, and `usePlaylistApi` now points here.
 *
 * `playlist_songs(count)` is a real PostgREST aggregate rather than the
 * SECURITY DEFINER trick used for like counts, and it is correct here: a
 * playlist's own song count is visible to exactly the person who can already see
 * the playlist, so counting under `playlist_songs_owner_all` returns the truth.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from('playlists')
    .select(`${PLAYLIST_COLUMNS}, playlist_songs(count)`)
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false });

  if (error) return respondToDbError(error, 'Failed to fetch playlists');

  const playlists = (data ?? []).map(row =>
    toPlaylistSummaryDto(row, row.playlist_songs[0]?.count ?? 0)
  );

  return privateNoStore(ApiResponse.success('Playlists fetched successfully', playlists, 200));
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return ApiResponse.error('Invalid JSON body', 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return ApiResponse.error(validationMessage(parsed.error), 400);
  }

  // `user_id` comes from the session. It is not in the schema, so a client that
  // sends one has it dropped by zod before this line rather than overriding it.
  const { data, error } = await auth.supabase
    .from('playlists')
    .insert({
      user_id: auth.user.id,
      name: parsed.data.name,
      description: parsed.data.description || null,
    })
    .select(PLAYLIST_COLUMNS)
    .single();

  if (error) return respondToDbError(error, 'Failed to create playlist');

  return ApiResponse.success('Playlist created successfully', toPlaylistSummaryDto(data, 0), 201);
}
