/**
 * Central export file for all query hooks
 * Import from this file to use TanStack Query hooks
 */

// Song Queries
export {
  useSongsInfinite,
  useSongsByFilter,
  useLikedSongs,
  useSongMutations,
  SONG_KEYS,
} from './useSongQueries';

// Playlist Queries
export {
  useUserPlaylists,
  usePlaylist,
  usePlaylistMutations,
  PLAYLIST_KEYS,
} from './usePlaylistQueries';

// Artist Queries
export {
  useArtistsInfinite,
  useArtistProfile,
  useArtistMutations,
  ARTIST_KEYS,
} from './useArtistQueries';

// Album Queries
export { useAlbumsInfinite, ALBUM_KEYS } from './useAlbumQueries';

// Admin Queries
export { useAdminMutations } from './useAdminQueries';

// User Queries
export { useUserQueries } from './useUserQueries';
