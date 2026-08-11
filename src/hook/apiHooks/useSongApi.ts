import { useApiClient } from './useApiClient';
import { useCallback } from 'react';
import type { SongWithRelations } from '@/types/models';

const SONG_ROUTE = {
  GET_SONGS: '/api/get-songs',
  LIKE_SONG: '/api/like-song',
  GET_LIKED_SONGS: '/api/get-liked-songs',
};

/** The `{ items, pagination }` payload both list endpoints return. */
export type SongsPage = {
  songs: SongWithRelations[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
};

/** The largest page `paginationSchema` accepts; anything more is clamped. */
const MAX_PAGE_SIZE = 100;

export default function useSongApi() {
  const { get, post, del } = useApiClient();

  const getSongs = useCallback(
    async ({
      page,
      limit,
      artist,
      album,
      movie,
    }: {
      page: number;
      limit: number;
      /** Catalogue filters for the singer/album/movie browse pages. */
      artist?: string;
      album?: string;
      movie?: string;
    }): Promise<SongsPage> => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (artist) params.set('artist', artist);
      if (album) params.set('album', album);
      if (movie) params.set('movie', movie);

      const response = await get(`${SONG_ROUTE.GET_SONGS}?${params.toString()}`);
      return response.data.data;
    },
    [get]
  );

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

  /**
   * Every page of the caller's likes, not just the first.
   *
   * The heart in the player is answered from this list, so a page-one window
   * would draw an empty heart on a song the user liked a while ago — and the
   * like that follows would come back 409 "already liked".
   */
  const getLikedSongs = useCallback(async (): Promise<SongWithRelations[]> => {
    const songs: SongWithRelations[] = [];

    for (let page = 1; ; page += 1) {
      const response = await get(
        `${SONG_ROUTE.GET_LIKED_SONGS}?page=${page}&limit=${MAX_PAGE_SIZE}`
      );
      const payload: SongsPage = response.data.data;
      songs.push(...payload.songs);
      if (!payload.pagination.hasMore) return songs;
    }
  }, [get]);

  return {
    getSongs,
    likeSong,
    unlikeSong,
    getLikedSongs,
  };
}
