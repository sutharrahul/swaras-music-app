/**
 * Central export file for all query hooks
 * Import from this file to use TanStack Query hooks
 */

// Song Queries
export { useSongs, useLikedSongs, useSongMutations, SONG_KEYS } from './useSongQueries';

// Playlist Queries
export {
  useUserPlaylists,
  usePlaylist,
  usePlaylistMutations,
  PLAYLIST_KEYS,
} from './usePlaylistQueries';

// Admin Queries
export { useAdminMutations } from './useAdminQueries';
