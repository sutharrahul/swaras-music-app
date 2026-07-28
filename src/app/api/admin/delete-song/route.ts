import { ApiResponse } from '@/app/utils/ApiResponse';
import { respondToDbError, validationMessage } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { removeSongObjects } from '@/lib/storage';
import { z } from 'zod';

const bodySchema = z.object({
  songId: z.string().min(1),
});

/**
 * BUG 1, privilege escalation — closed.
 *
 * The old handler took `{ songId, userId }` from the body, looked up *that*
 * user, and checked *their* role. Anyone who knew an admin's internal id (which
 * `/api/check-admin` handed out, bug 6) could delete any song. The caller was
 * never checked at all.
 *
 * Now the actor comes only from the session (R1). `userId` is not read, and
 * would be ignored if sent. Underneath this, `songs_write_admin` means even a
 * bug here cannot delete a row for a non-admin.
 */
export async function DELETE(request: Request) {
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
  const { songId } = parsed.data;

  const { data: song, error: fetchError } = await supabase
    .from('songs')
    .select('id, title, audio_path, cover_path')
    .eq('id', songId)
    .maybeSingle();

  if (fetchError) return respondToDbError(fetchError, 'Failed to delete song');
  if (!song) return ApiResponse.error('Song not found', 404);

  /**
   * OBJECTS FIRST, ROW SECOND — and the old code had it the other way round.
   *
   * There is no transaction spanning Postgres and Storage, so one of the two
   * half-states is unavoidable. Pick the recoverable one:
   *
   *   * row deleted, objects left  -> orphaned bytes nothing references and
   *     nothing can find again. They are billed forever and only a manual sweep
   *     will ever notice them. Unrecoverable in practice.
   *   * objects deleted, row left  -> one track 404s on play. Visible, and
   *     fixed by retrying this exact request, because `remove()` on an absent
   *     object is a no-op rather than an error.
   *
   * So the delete is aborted if any object survives, and nothing is lost: the
   * song is still there, still consistent, and the caller can retry.
   */
  const removed = await removeSongObjects(supabase, {
    audioPath: song.audio_path,
    coverPath: song.cover_path,
  });

  if (!removed) {
    return ApiResponse.error('Failed to remove the song files; the song was not deleted', 500);
  }

  const { error: deleteError } = await supabase.from('songs').delete().eq('id', songId);

  if (deleteError) return respondToDbError(deleteError, 'Failed to delete song');

  return ApiResponse.success('Song deleted successfully', { id: song.id, title: song.title }, 200);
}
