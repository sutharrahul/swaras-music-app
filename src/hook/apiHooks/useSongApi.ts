import { useApiClient } from './useApiClient';
import { useCallback } from 'react';

const SONG_ROUTE = {
  GET_SONGS: '/api/get-songs',
  LIKE_SONG: '/api/like-song',
  GET_LIKED_SONGS: '/api/get-liked-songs',
};

export default function useSongApi() {
  const { get, post, del } = useApiClient();

  const getSongs = useCallback(async () => {
    const response = await get(SONG_ROUTE.GET_SONGS);
    return response.data;
  }, [get]);

  // `userId` is deliberately absent from all three of these. Sending one is what
  // made like/unlike/liked-songs act on arbitrary accounts; the endpoints take
  // the actor from the session now.
  const likeSong = useCallback(
    async (data: { songId: string }) => {
      const response = await post(SONG_ROUTE.LIKE_SONG, data);
      return response.data;
    },
    [post]
  );

  const unlikeSong = useCallback(
    async (data: { songId: string }) => {
      const response = await del(SONG_ROUTE.LIKE_SONG, { data });
      return response.data;
    },
    [del]
  );

  const getLikedSongs = useCallback(async () => {
    const response = await get(SONG_ROUTE.GET_LIKED_SONGS);
    return response.data;
  }, [get]);

  return {
    getSongs,
    likeSong,
    unlikeSong,
    getLikedSongs,
  };
}
