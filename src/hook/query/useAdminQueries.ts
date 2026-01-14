import { useMutation, useQueryClient } from '@tanstack/react-query';
import useAdminApi from '../apiHooks/useAdminApi';
import { SONG_KEYS } from './useSongQueries';
import { PLAYLIST_KEYS } from './usePlaylistQueries';

// ============== MUTATIONS ==============

export function useAdminMutations() {
  const queryClient = useQueryClient();
  const { deleteSong } = useAdminApi();

  /**
   * Delete a song (Admin only)
   */
  const deleteSongMutation = useMutation({
    mutationFn: (songId: string) => deleteSong(songId),
    onSuccess: () => {
      // Invalidate all songs and playlists since the song might be in playlists
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.all });
    },
  });

  return {
    deleteSongMutation,
  };
}
