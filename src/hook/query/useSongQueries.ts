import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useSongApi from '../apiHooks/useSongApi';

export const SONG_KEYS = {
  all: ['songs'] as const,
  liked: (userId: string) => ['songs', 'liked', userId] as const,
};

// ============== QUERIES ==============

/**
 * Fetch all songs
 */
export function useSongs() {
  const { getSongs } = useSongApi();

  return useQuery({
    queryKey: SONG_KEYS.all,
    queryFn: getSongs,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch liked songs for a user
 */
export function useLikedSongs(userId: string, enabled = true) {
  const { getLikedSongs } = useSongApi();

  return useQuery({
    queryKey: SONG_KEYS.liked(userId),
    queryFn: () => getLikedSongs(userId),
    enabled: enabled && !!userId,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

// ============== MUTATIONS ==============

export function useSongMutations() {
  const queryClient = useQueryClient();
  const { uploadSong, likeSong, unlikeSong } = useSongApi();

  /**
   * Upload a new song
   */
  const uploadSongMutation = useMutation({
    mutationFn: (formData: FormData) => uploadSong(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
    },
  });

  /**
   * Like a song
   */
  const likeSongMutation = useMutation({
    mutationFn: (data: { userId: string; songId: string }) => likeSong(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.liked(variables.userId) });
    },
  });

  /**
   * Unlike a song
   */
  const unlikeSongMutation = useMutation({
    mutationFn: (data: { userId: string; songId: string }) => unlikeSong(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.liked(variables.userId) });
    },
  });

  return {
    uploadSongMutation,
    likeSongMutation,
    unlikeSongMutation,
  };
}
