import { useApiClient } from './useApiClient';
import { useCallback } from 'react';

const ALBUM_ROUTE = {
  LIST: '/api/albums',
};

export type AlbumSummary = { name: string; songCount: number; coverUrl: string | null };

export type AlbumsPage = {
  albums: AlbumSummary[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
};

/**
 * Albums have no profile endpoint, unlike artists. An artist page needs a second
 * request for the uploaded photo; an album's cover comes from its own songs and
 * is already on every row of the list, so there is nothing else to fetch.
 */
export default function useAlbumApi() {
  const { get } = useApiClient();

  const getAlbums = useCallback(
    async ({ page, limit }: { page: number; limit: number }): Promise<AlbumsPage> => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const response = await get(`${ALBUM_ROUTE.LIST}?${params.toString()}`);
      return response.data.data;
    },
    [get]
  );

  return { getAlbums };
}
