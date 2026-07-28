import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import usePlaylistApi from '../apiHooks/usePlaylistApi';

// `user` takes no id: /api/playlists returns the signed-in caller's own
// playlists and there is no way to ask it for anyone else's.
export const PLAYLIST_KEYS = {
  all: ['playlists'] as const,
  user: ['playlists', 'user'] as const,
  detail: (playlistId: string) => ['playlists', 'detail', playlistId] as const,
};

// ============== QUERIES ==============

/**
 * Fetch all playlists for a user
 */
export function useUserPlaylists(enabled = true) {
  const { getUserPlaylists } = usePlaylistApi();

  return useQuery({
    queryKey: PLAYLIST_KEYS.user,
    queryFn: getUserPlaylists,
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch a specific playlist by ID
 */
export function usePlaylist(playlistId: string, enabled = true) {
  const { getPlaylistById } = usePlaylistApi();

  return useQuery({
    queryKey: PLAYLIST_KEYS.detail(playlistId),
    queryFn: () => getPlaylistById(playlistId),
    enabled: enabled && !!playlistId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

// ============== MUTATIONS ==============

export function usePlaylistMutations() {
  const queryClient = useQueryClient();
  const { createPlaylist, addSongToPlaylist, deletePlaylist, removeSongFromPlaylist } =
    usePlaylistApi();

  /**
   * Create a new playlist
   */
  const createPlaylistMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => createPlaylist(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.user });
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.all });
    },
  });

  /**
   * Add a song to an existing playlist
   */
  const addSongToPlaylistMutation = useMutation({
    mutationFn: (data: { playlistId: string; songId: string }) => addSongToPlaylist(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: PLAYLIST_KEYS.detail(variables.playlistId),
      });
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.all });
    },
  });

  /**
   * Delete a playlist
   */
  const deletePlaylistMutation = useMutation({
    mutationFn: (playlistId: string) => deletePlaylist(playlistId),
    onSuccess: (_, playlistId) => {
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.user });
      queryClient.invalidateQueries({
        queryKey: PLAYLIST_KEYS.detail(playlistId),
      });
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.all });
    },
  });

  /**
   * Remove a song from a playlist
   */
  const removeSongFromPlaylistMutation = useMutation({
    mutationFn: (data: { playlistId: string; songId: string }) => removeSongFromPlaylist(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: PLAYLIST_KEYS.detail(variables.playlistId),
      });
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.all });
    },
  });

  return {
    createPlaylistMutation,
    addSongToPlaylistMutation,
    deletePlaylistMutation,
    removeSongFromPlaylistMutation,
  };
}
