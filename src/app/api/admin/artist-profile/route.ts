import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { ARTIST_COLUMNS } from '@/lib/dto';
import { artistImageUrl } from '@/lib/storage';
import { z } from 'zod';

/**
 * The artist's written profile — currently just the bio.
 *
 * A separate route from `/api/admin/artist-photo` rather than another method on
 * it: that one exists to broker a Storage upload (mint a path, confirm the
 * bytes landed, delete the superseded object) and none of that applies to a
 * paragraph of text. Sharing them would mean one handler with two unrelated
 * jobs and a body schema that only makes sense half the time.
 *
 * Keyed by `name`, like the photo mint, and for the same reason: the artist
 * list is derived from `songs.artist` and carries no row id, because an artist
 * need not have an `artists` row at all until something is written about them.
 */
const bodySchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    // `.nullable()` is the clear-it case. An empty string would be stored and
    // then render as an empty paragraph, so it is normalised to null below.
    bio: z.string().trim().max(2000).nullable(),
  })
  .strict();

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
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

  const { name } = parsed.data;
  const bio = parsed.data.bio === null || parsed.data.bio === '' ? null : parsed.data.bio;

  // Upsert, not update: an artist derived from `songs.artist` has no profile row
  // until someone writes one, and the first thing written about them is often
  // the bio rather than the photo. `onConflict: 'name'` leans on the existing
  // `artists_name_key` unique index, so two admins saving at once resolve to one
  // row instead of a 23505 for whoever loses.
  const { data, error } = await auth.supabase
    .from('artists')
    .upsert({ name, bio }, { onConflict: 'name' })
    .select(ARTIST_COLUMNS)
    .single();

  if (error) return respondToDbError(error, 'Failed to save the artist profile');

  return ApiResponse.success(
    'Artist profile saved',
    {
      artist: {
        name: data.name,
        bio: data.bio,
        imageUrl: artistImageUrl(data.image_path),
      },
    },
    200
  );
}
