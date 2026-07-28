import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { z } from 'zod';

const bodySchema = z.object({
  songId: z.string().min(1),
});

/**
 * BUG 2 — closed.
 *
 * Both handlers used to take `{ userId, songId }` from the body and had no auth
 * at all: anyone could like or unlike a song as anyone else, and enumerate which
 * user ids existed while doing it. `userId` is no longer read from the body; if
 * a stale client still sends one it is ignored. `likes_owner_all` enforces the
 * same rule underneath, so even a mistake here cannot write another user's row.
 */
async function readBody(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { ok: false as const, response: ApiResponse.error('Invalid JSON body', 400) };
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false as const,
      response: ApiResponse.error(validationMessage(parsed.error), 400),
    };
  }

  return { ok: true as const, songId: parsed.data.songId };
}

export async function POST(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await readBody(request);
  if (!body.ok) return body.response;

  const { error } = await auth.supabase
    .from('likes')
    .insert({ user_id: auth.user.id, song_id: body.songId });

  // 23505 is the (user_id, song_id) unique index — "already liked", a 409 rather
  // than a 500. 23503 is the FK: the song does not exist, so 404.
  if (error) return respondToDbError(error, 'Failed to like song');

  return ApiResponse.success('Song liked successfully', { songId: body.songId }, 201);
}

export async function DELETE(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const body = await readBody(request);
  if (!body.ok) return body.response;

  // `select` so the count distinguishes "unliked it" from "there was nothing to
  // unlike". Without the session filter this delete would be scoped only by RLS;
  // the explicit `user_id` makes the intent visible at the call site too.
  const { data, error } = await auth.supabase
    .from('likes')
    .delete()
    .eq('user_id', auth.user.id)
    .eq('song_id', body.songId)
    .select('id');

  if (error) return respondToDbError(error, 'Failed to unlike song');
  if (!data || data.length === 0) return ApiResponse.error('That song is not liked', 404);

  return ApiResponse.success('Song unliked successfully', { songId: body.songId }, 200);
}
