import { useMutation, useQueryClient } from '@tanstack/react-query';
import useAdminApi from '../apiHooks/useAdminApi';
import { SONG_KEYS } from './useSongQueries';
import { PLAYLIST_KEYS } from './usePlaylistQueries';
import { ARTIST_KEYS } from './useArtistQueries';
import { ALBUM_KEYS } from './useAlbumQueries';

// ============== MUTATIONS ==============

export function useAdminMutations() {
  const queryClient = useQueryClient();
  const { deleteSong, updateSong } = useAdminApi();

  /**
   * Delete a song (Admin only)
   */
  const deleteSongMutation = useMutation({
    mutationFn: (songId: string) => deleteSong(songId),
    onSuccess: () => {
      // Invalidate all songs and playlists since the song might be in playlists
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
      queryClient.invalidateQueries({ queryKey: PLAYLIST_KEYS.all });
      // The artist list is derived from `songs.artist`, so removing a song drops
      // that artist's count by one — and drops the artist entirely if it was
      // their last track. Without this the admin watches a card they just
      // emptied keep its old count for the full 5-minute staleTime.
      queryClient.invalidateQueries({ queryKey: ARTIST_KEYS.all, refetchType: 'all' });
      // Albums are derived from `songs.album` exactly as artists are from
      // `songs.artist`, so the same write invalidates both directories.
      queryClient.invalidateQueries({ queryKey: ALBUM_KEYS.all, refetchType: 'all' });
    },
  });

  /**
   * Fill in / correct a song's metadata (Admin only) — title, artist, album,
   * movie, genre, composers, lyrics.
   */
  const updateSongMutation = useMutation({
    mutationFn: updateSong,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
      // Retagging is how an artist is renamed here — there is no artist row to
      // edit, only `songs.artist`. One save can therefore create an artist,
      // empty another, and move a count in both directions at once.
      queryClient.invalidateQueries({ queryKey: ARTIST_KEYS.all, refetchType: 'all' });
      // Albums are derived from `songs.album` exactly as artists are from
      // `songs.artist`, so the same write invalidates both directories.
      queryClient.invalidateQueries({ queryKey: ALBUM_KEYS.all, refetchType: 'all' });
    },
  });

  return {
    deleteSongMutation,
    updateSongMutation,
  };
}
