import { useApiClient } from './useApiClient';
import { useCallback } from 'react';

/**
 * `/api/get-playlist` is gone. It took `?userId=`/`?playlistId=` from the query
 * with no auth at all and returned the owner's email address — a strictly worse
 * duplicate of the two `/api/playlists` routes, which is where these now point.
 *
 * No function here takes a user id any more. The endpoints derive the owner from
 * the session cookie, so passing one would at best be ignored and at worst be
 * the IDOR this migration removes.
 */
const PLAYLIST_ROUTE = {
  PLAYLISTS: '/api/playlists',
  POST_PLAYLIST: '/api/post-playlist',
  DELETE_PLAYLIST: '/api/delete-playlist',
  REMOVE_PLAYLIST_SONG: '/api/remove-playlist-song',
};

export default function usePlaylistApi() {
  const { get, post, del } = useApiClient();

  /** The signed-in user's own playlists. */
  const getUserPlaylists = useCallback(async () => {
    const response = await get(PLAYLIST_ROUTE.PLAYLISTS);
    return response.data;
  }, [get]);

  const getPlaylistById = useCallback(
    async (playlistId: string) => {
      const response = await get(`${PLAYLIST_ROUTE.PLAYLISTS}/${playlistId}`);
      return response.data;
    },
    [get]
  );

  const createPlaylist = useCallback(
    async (data: { name: string; description?: string }) => {
      const response = await post(PLAYLIST_ROUTE.PLAYLISTS, data);
      return response.data;
    },
    [post]
  );

  const addSongToPlaylist = useCallback(
    async (data: { playlistId: string; songId: string }) => {
      const response = await post(PLAYLIST_ROUTE.POST_PLAYLIST, data);
      return response.data;
    },
    [post]
  );

  const deletePlaylist = useCallback(
    async (playlistId: string) => {
      const response = await del(PLAYLIST_ROUTE.DELETE_PLAYLIST, {
        data: { playlistId },
      });
      return response.data;
    },
    [del]
  );

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
