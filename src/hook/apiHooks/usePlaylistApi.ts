import { useApiClient } from './useApiClient';
import { useCallback } from 'react';

const PLAYLIST_ROUTE = {
  GET_PLAYLIST: '/api/get-playlist',
  POST_PLAYLIST: '/api/post-playlist',
  DELETE_PLAYLIST: '/api/delete-playlist',
  REMOVE_PLAYLIST_SONG: '/api/remove-playlist-song',
};

export default function usePlaylistApi() {
  const { get, post, del } = useApiClient();

  // Get all playlists for a user
  const getUserPlaylists = useCallback(
    async (userId: string) => {
      const response = await get(`${PLAYLIST_ROUTE.GET_PLAYLIST}?userId=${userId}`);
      return response.data;
    },
    [get]
  );

  // Get a specific playlist by ID
  const getPlaylistById = useCallback(
    async (playlistId: string) => {
      const response = await get(`${PLAYLIST_ROUTE.GET_PLAYLIST}?playlistId=${playlistId}`);
      return response.data;
    },
    [get]
  );

  // Create new playlist with song
  const createPlaylist = useCallback(
    async (data: { userId: string; playlistName: string; songId: string }) => {
      const response = await post(PLAYLIST_ROUTE.POST_PLAYLIST, data);
      return response.data;
    },
    [post]
  );

  // Add song to existing playlist
  const addSongToPlaylist = useCallback(
    async (data: { playlistId: string; songId: string }) => {
      const response = await post(PLAYLIST_ROUTE.POST_PLAYLIST, data);
      return response.data;
    },
    [post]
  );

  // Delete entire playlist
  const deletePlaylist = useCallback(
    async (playlistId: string) => {
      const response = await del(PLAYLIST_ROUTE.DELETE_PLAYLIST, {
        data: { playlistId },
      });
      return response.data;
    },
    [del]
  );

  // Remove song from playlist
  const removeSongFromPlaylist = useCallback(
    async (data: { playlistId: string; songId: string }) => {
      const response = await del(PLAYLIST_ROUTE.REMOVE_PLAYLIST_SONG, {
        data,
      });
      return response.data;
    },
    [del]
  );

  return {
    getUserPlaylists,
    getPlaylistById,
    createPlaylist,
    addSongToPlaylist,
    deletePlaylist,
    removeSongFromPlaylist,
  };
}
