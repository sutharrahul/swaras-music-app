/**
 * Central export file for all query hooks
 * Import from this file to use TanStack Query hooks
 */

// Song Queries
export {
  useSongsInfinite,
  useSongsPage,
  useSongsByFilter,
  useLikedSongs,
  useSongMutations,
  SONG_KEYS,
  SONGS_PER_PAGE,
} from './useSongQueries';

// Playlist Queries. `PLAYLIST_KEYS` is not re-exported: its only consumer is
// `useAdminQueries`, which is a sibling and imports it directly.
export { useUserPlaylists, usePlaylist, usePlaylistMutations } from './usePlaylistQueries';

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
