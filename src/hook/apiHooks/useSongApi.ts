import { useApiClient } from './useApiClient';
import { useCallback } from 'react';

const SONG_ROUTE = {
  GET_SONGS: '/api/get-songs',
  UPLOAD_SONG: '/api/upload-song',
  LIKE_SONG: '/api/like-song',
  GET_LIKED_SONGS: '/api/get-liked-songs',
};

export default function useSongApi() {
  const { get, post, del } = useApiClient();

  const getSongs = useCallback(async () => {
    const response = await get(SONG_ROUTE.GET_SONGS);
    return response.data;
  }, [get]);

  const uploadSong = useCallback(
    async (formData: FormData) => {
      const response = await post(SONG_ROUTE.UPLOAD_SONG, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    [post]
  );

  const likeSong = useCallback(
    async (data: { userId: string; songId: string }) => {
      const response = await post(SONG_ROUTE.LIKE_SONG, data);
      return response.data;
    },
    [post]
  );

  const unlikeSong = useCallback(
    async (data: { userId: string; songId: string }) => {
      const response = await del(SONG_ROUTE.LIKE_SONG, { data });
      return response.data;
    },
    [del]
  );

  const getLikedSongs = useCallback(
    async (userId: string) => {
      const response = await get(`${SONG_ROUTE.GET_LIKED_SONGS}?userId=${userId}`);
      return response.data;
    },
    [get]
  );

  return {
    getSongs,
    uploadSong,
    likeSong,
    unlikeSong,
    getLikedSongs,
  };
}
