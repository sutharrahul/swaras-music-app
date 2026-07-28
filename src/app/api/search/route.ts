import { ApiResponse } from '@/app/utils/ApiResponse';
import { privateNoStore, respondToDbError, validationMessage } from '@/lib/api';
import { optionalUser } from '@/lib/auth';
import { coverUrl } from '@/lib/storage';
import { z } from 'zod';

const querySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(100),
});

const RESULT_LIMIT = 10;

/**
 * PostgREST's `or=` takes a filter *expression* as a string, so an unescaped
 * search term is a filter-injection surface: a comma ends the current condition
 * and a parenthesis closes the group, which lets a crafted `q` bolt extra
 * predicates onto the query. Structural characters are stripped rather than
 * escaped — quoting rules differ between the `ilike` and `cs` operators, and a
 * search box has no legitimate use for them. `%` and `*` go too, so a user
 * cannot turn every search into a full-table `ilike '%%'` scan.
 */
const sanitize = (term: string) => term.replace(/[,()"'\\%*{}]/g, ' ').trim();

/**
 * Public songs plus, for a signed-in caller, their own playlists.
 *
 * R7: the response mixes public catalogue with per-user rows, so it is
 * `private, no-store`. Without that a shared cache (or Next's own) could hand
 * one user's playlist names to the next visitor who searched the same word.
 * This is the one endpoint where the caching header is a security control
 * rather than a performance tweak.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({ q: searchParams.get('q') ?? '' });
  if (!parsed.success) {
    return ApiResponse.error(validationMessage(parsed.error), 400);
  }

  const term = sanitize(parsed.data.q);
  if (!term) {
    return privateNoStore(ApiResponse.success('Search results', { songs: [], playlists: [] }, 200));
  }

  // Anonymous callers are served: `user` is null and the playlist half is
  // skipped. It never reads an id from the request either way.
  const { supabase, user } = await optionalUser();

  const { data: songs, error: songsError } = await supabase
    .from('songs')
    .select('id, title, artist, album, cover_path')
    .or(`title.ilike.*${term}*,album.ilike.*${term}*,artist.cs.{${term}}`)
    .limit(RESULT_LIMIT);

  if (songsError) return respondToDbError(songsError, 'Failed to search');

  let playlists: { id: string; name: string; description: string | null }[] = [];

  if (user) {
    const { data, error } = await supabase
      .from('playlists')
      .select('id, name, description')
      .eq('user_id', user.id)
      .or(`name.ilike.*${term}*,description.ilike.*${term}*`)
      .limit(RESULT_LIMIT);

    if (error) return respondToDbError(error, 'Failed to search');
    playlists = data ?? [];
  }

  return privateNoStore(
    ApiResponse.success(
      'Search results',
      {
        songs: (songs ?? []).map(song => ({
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          coverUrl: coverUrl(song.cover_path),
        })),
        playlists,
      },
      200
    )
  );
}
