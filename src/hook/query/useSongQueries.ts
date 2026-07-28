import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useSongApi from '../apiHooks/useSongApi';

// No user id in the cache keys. The liked-songs endpoint is scoped by the
// session cookie, so the response already belongs to whoever is signed in, and
// a key naming another user could only ever be a lie.
//
// That makes emptying the cache on an auth change mandatory, and `router.push` +
// `router.refresh()` does NOT do it: refresh() re-renders Server Components and
// deliberately keeps client state, so the provider never remounts. The clear
// happens in `src/components/Providers.tsx`, on the `onAuthStateChange`
// SIGNED_IN / SIGNED_OUT events. Don't remove it.
export const SONG_KEYS = {
  all: ['songs'] as const,
  liked: ['songs', 'liked'] as const,
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
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch liked songs for a user
 */
export function useLikedSongs(enabled = true) {
  const { getLikedSongs } = useSongApi();

  return useQuery({
    queryKey: SONG_KEYS.liked,
    queryFn: getLikedSongs,
    enabled,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

// ============== MUTATIONS ==============

export function useSongMutations() {
  const queryClient = useQueryClient();
  const { likeSong, unlikeSong } = useSongApi();

  /**
   * Like a song
   */
  const likeSongMutation = useMutation({
    mutationFn: (data: { songId: string }) => likeSong(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.liked });
    },
  });

  /**
   * Unlike a song
   */
  const unlikeSongMutation = useMutation({
    mutationFn: (data: { songId: string }) => unlikeSong(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.liked });
    },
  });

  return {
    likeSongMutation,
    unlikeSongMutation,
  };
}
