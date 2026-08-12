import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { ARTIST_COLUMNS } from '@/lib/dto';
import { artistImageUrl } from '@/lib/storage';
import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

/**
 * One artist's profile photo — what the banner on `/artist/[name]` reads.
 *
 * THE NAME IS A QUERY PARAM, NOT A PATH SEGMENT. `AC/DC` is a real artist name,
 * and a route shaped `/api/artists/AC%2FDC` depends on the encoded slash
 * surviving path normalisation on the way through Next, which it does not do
 * reliably — the request can arrive already split into two segments. A query
 * param is decoded exactly once, by `URL`, with no path semantics attached to
 * it, so slashes and dots in a name are just characters.
 *
 * A MISSING ROW IS A 200 WITH `imageUrl: null`, NEVER A 404. `public.artists`
 * is a profile side-table, not the catalogue: an artist exists because a song
 * names them, so having no row here is the NORMAL state and means "no photo
 * yet", not "no such artist". Returning a 404 would make TanStack Query mark the
 * query failed and paint an error state over an artist page that is working
 * perfectly — songs listed, playback fine — because a photo is absent.
 */
const querySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({ name: searchParams.get('name') ?? undefined });
  if (!parsed.success) {
    return ApiResponse.error(validationMessage(parsed.error), 400);
  }

  const { name } = parsed.data;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from('artists')
    .select(ARTIST_COLUMNS)
    .eq('name', name)
    .maybeSingle();

  if (error) return respondToDbError(error, 'Failed to fetch the artist');

  // `name` is echoed from the validated query, not from `data`: there may well
  // be no row, and the caller asked about this name either way.
  //
  // `bio` is null for an artist with no row AND for one whose row has no bio
  // written yet — the page renders nothing in either case, so it does not need
  // to tell them apart.
  return ApiResponse.success(
    'Artist fetched successfully',
    {
      artist: {
        name,
        bio: data?.bio ?? null,
        imageUrl: artistImageUrl(data?.image_path ?? null),
      },
    },
    200
  );
}
