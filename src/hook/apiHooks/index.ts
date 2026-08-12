/**
 * Central export file for all API hooks
 * Import from this file to use API call hooks
 */

export { useApiClient, apiErrorMessage } from './useApiClient';
export { default as useSongApi } from './useSongApi';
export { default as usePlaylistApi } from './usePlaylistApi';
export { default as useAdminApi } from './useAdminApi';
export { default as useArtistApi } from './useArtistApi';
export { default as useAlbumApi } from './useAlbumApi';
export { useGetSongApi } from './useGetSongApi';
export { default as useUserApi } from './useUserApi';
