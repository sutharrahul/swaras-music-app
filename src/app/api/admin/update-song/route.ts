import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { SONG_COLUMNS, toSongDtos } from '@/lib/dto';
import { z } from 'zod';

/**
 * Fills in whatever metadata ID3 tags didn't have — admin-only, one song at a
 * time. `songId` identifies which row to touch, not who is acting; the actor
 * still comes only from `requireAdmin()`, same as `delete-song`.
 *
 * `.strict()` + only the fields actually sent get written: a field omitted
 * from the body is left alone, not nulled out. At least one field beyond
 * `songId` is required, or this would be a no-op PATCH that still round-trips
 * to the database.
 */
const bodySchema = z
  .object({
    songId: z.string().min(1),
    title: z.string().trim().min(1).max(200).optional(),
    artist: z.array(z.string().trim().min(1)).min(1).optional(),
    composers: z.array(z.string().trim().min(1)).optional(),
    album: z.string().trim().min(1).max(200).nullable().optional(),
    movie: z.string().trim().min(1).max(200).nullable().optional(),
    genre: z.string().trim().min(1).max(100).nullable().optional(),
    lyrics: z.string().max(20000).nullable().optional(),
  })
  .strict()
  .refine(
    body => Object.keys(body).some(key => key !== 'songId'),
    'At least one field to update is required'
  );

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

  const { supabase } = auth;
  const { songId, ...fields } = parsed.data;

  const { data, error } = await supabase
    .from('songs')
    .update(fields)
    .eq('id', songId)
    .select(SONG_COLUMNS)
    .maybeSingle();

  if (error) return respondToDbError(error, 'Failed to update song');
  if (!data) return ApiResponse.error('Song not found', 404);

  const [song] = await toSongDtos(supabase, [data]);

  return ApiResponse.success('Song updated successfully', { song }, 200);
}
