import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import usePlaylistApi from '../apiHooks/usePlaylistApi';

export const PLAYLIST_KEYS = {
  all: ['playlists'] as const,
  user: (userId: string) => ['playlists', 'user', userId] as const,
  detail: (playlistId: string) => ['playlists', 'detail', playlistId] as const,
};

// ============== QUERIES ==============

/**
 * Fetch all playlists for a user
 */
export function useUserPlaylists(userId: string, enabled = true) {
  const { getUserPlaylists } = usePlaylistApi();

  return useQuery({
    queryKey: PLAYLIST_KEYS.user(userId),
    queryFn: () => getUserPlaylists(userId),
    enabled: enabled && !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
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
  const {
    createPlaylist,
    addSongToPlaylist,
    deletePlaylist,
    removeSongFromPlaylist,
  } = usePlaylistApi();

  /**
   * Create a new playlist
   */
  const createPlaylistMutation = useMutation({
    mutationFn: (data: { userId: string; playlistName: string; songId: string }) =>
      createPlaylist(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.user(variables.userId) });
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
    mutationFn: (data: { playlistId: string; userId: string }) =>
      deletePlaylist(data.playlistId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.user(variables.userId) });
      queryClient.invalidateQueries({
        queryKey: PLAYLIST_KEYS.detail(variables.playlistId),
      });
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.all });
    },
  });

  /**
   * Remove a song from a playlist
   */
  const removeSongFromPlaylistMutation = useMutation({
    mutationFn: (data: { playlistId: string; songId: string }) =>
      removeSongFromPlaylist(data),
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
