import { ApiResponse } from '@/app/utils/ApiResponse';
import { parsePagination, respondToDbError, validationMessage } from '@/lib/api';
import { type AlbumDto } from '@/lib/dto';
import { coverUrl } from '@/lib/storage';
import { createClient } from '@/utils/supabase/server';

/**
 * The album directory. The sibling of `/api/artists`, and deliberately built the
 * same way — see that file for the reasoning behind the two decisions repeated
 * here: the ordering is stated twice (PostgREST wraps a set-returning function
 * in an outer LIMIT/OFFSET and will not preserve an inner sort, which would make
 * `range()` produce duplicates and gaps across pages), and there is no
 * `privateNoStore()` because the response is byte-identical for every caller
 * with no signed URLs in it.
 *
 * One thing this does NOT need that `/api/artists` does: a second query for
 * artwork. An album has no profile row — its cover is one of its own songs'
 * covers, which `album_song_counts()` already returns — so there is nothing to
 * merge and nothing that can fall out of sync.
 *
 * Songs with no album never reach here: the aggregate filters out null and blank
 * album names, so an untagged song belongs to no album rather than collecting in
 * an "Unknown" bucket.
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
    .rpc('album_song_counts', undefined, { count: 'exact' })
    .order('song_count', { ascending: false })
    .order('album_name', { ascending: true })
    .range(from, from + limit - 1);

  if (error) return respondToDbError(error, 'Failed to fetch albums');

  const rows = data ?? [];

  const albums: AlbumDto[] = rows.map(row => ({
    name: row.album_name,
    // `bigint` arrives from PostgREST as a string or a number depending on size.
    songCount: Number(row.song_count),
    coverUrl: coverUrl(row.cover_path),
  }));

  const total = count ?? 0;

  return ApiResponse.success(
    'Albums fetched successfully',
    {
      albums,
      pagination: { page, limit, total, hasMore: from + albums.length < total },
    },
    200
  );
}
