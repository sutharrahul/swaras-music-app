import { ApiResponse } from '@/app/utils/ApiResponse';
import { parsePagination, respondToDbError, validationMessage } from '@/lib/api';
import { artistImagePaths, type ArtistDto } from '@/lib/dto';
import { artistImageUrl } from '@/lib/storage';
import { createClient } from '@/utils/supabase/server';

/**
 * The artist directory.
 *
 * The list is DERIVED, not stored. `artist_song_counts()` unnests
 * `songs.artist text[]` and counts, so an artist appears here because a song
 * names them. `public.artists` is only a profile side-table and is consulted
 * afterwards, purely for the photo — which is why a name with no row there is
 * normal rather than an error (see `artistImagePaths`, which fails soft).
 *
 * THE ORDERING IS STATED TWICE — once inside the SQL function, and again as the
 * `.order()` calls below. That is not redundancy to tidy up. PostgREST
 * paginates a set-returning function by wrapping the call in an outer select
 * with LIMIT/OFFSET, and Postgres does not promise that a sort inside a
 * subquery survives the wrapper. Drop the outer ORDER BY and the planner is free
 * to hand back rows in any order it likes, which reshuffles between pages and
 * makes `range()` produce duplicates and gaps.
 *
 * NOT `privateNoStore()`, deliberately — and this is the only list endpoint in
 * the app that can say so. The response is byte-identical for every caller:
 * no per-user rows, no signed tokens, and the photo URLs are permanent
 * public-bucket URLs that never expire. `/api/get-songs` is `private, no-store`
 * because it carries *expiring signed audio URLs* (see its doc comment); that
 * reason does not apply here. There is no positive cache header either: no
 * other route in this codebase sets one, and picking a TTL for this one route
 * would be a caching policy invented in the wrong place.
 */
export async function GET(request: Request) {
  const pagination = parsePagination(request.url);
  if (!pagination.success) {
    return ApiResponse.error(validationMessage(pagination.error), 400);
  }

  const { page, limit } = pagination.data;
  const from = (page - 1) * limit;

  const supabase = await createClient();

  // `undefined` rather than `{}` for the args: the function takes no parameters,
  // so the generated types give it `Args: never` and an empty object is a type
  // error. `count: 'exact'` still needs to be the third argument.
  const { data, count, error } = await supabase
    .rpc('artist_song_counts', undefined, { count: 'exact' })
    .order('song_count', { ascending: false })
    .order('artist_name', { ascending: true })
    .range(from, from + limit - 1);

  if (error) return respondToDbError(error, 'Failed to fetch artists');

  const rows = data ?? [];

  const paths = await artistImagePaths(
    supabase,
    rows.map(row => row.artist_name)
  );

  const artists: ArtistDto[] = rows.map(row => ({
    name: row.artist_name,
    // `song_count` is a `bigint`. PostgREST hands those back as a JSON string
    // once they leave the safe-integer range, so the generated `number` type is
    // a best case rather than a guarantee — same coercion as `likeCounts()`.
    songCount: Number(row.song_count),
    imageUrl: artistImageUrl(paths.get(row.artist_name) ?? null),
  }));

  const total = count ?? 0;

  return ApiResponse.success(
    'Artists fetched successfully',
    {
      artists,
      pagination: { page, limit, total, hasMore: from + artists.length < total },
    },
    200
  );
}
