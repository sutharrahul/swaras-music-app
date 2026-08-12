import { useInfiniteQuery } from '@tanstack/react-query';
import useAlbumApi from '../apiHooks/useAlbumApi';

// `all` is nobody's query key — it is the prefix everything album-shaped shares,
// so one invalidation covers the home rail and the /albums grid at once. The
// admin song mutations invalidate it for the same reason they invalidate
// ARTIST_KEYS: the album list is DERIVED from `songs.album`, so retagging or
// deleting a song changes which albums exist and how many songs each has.
export const ALBUM_KEYS = {
  all: ['albums'] as const,
  list: ['albums', 'list'] as const,
};

const PAGE_SIZE = 24;

/**
 * Every album, newest-largest first. One cache entry serves both the home rail
 * (which slices the first few) and the /albums grid, so moving between them
 * costs no refetch — the same arrangement `useArtistsInfinite` uses.
 */
export function useAlbumsInfinite() {
  const { getAlbums } = useAlbumApi();

  return useInfiniteQuery({
    queryKey: ALBUM_KEYS.list,
    queryFn: ({ pageParam }) => getAlbums({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: last => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}
