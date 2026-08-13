import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { SongWithRelations } from '@/types/models';
import useSongApi from '../apiHooks/useSongApi';

// No user id in the cache keys. The liked-songs endpoint is scoped by the
// session cookie, so the response already belongs to whoever is signed in, and
// a key naming another user could only ever be a lie.
//
// That makes emptying the cache on an auth change mandatory, and `router.push` +
// `router.refresh()` does NOT do it: refresh() re-renders Server Components and
// deliberately keeps client state, so the provider never remounts. The clear
// happens in `src/components/Providers.tsx`, on the `onAuthStateChange`
// SIGNED_IN / SIGNED_OUT events. Don't remove it.
//
// `all` is nobody's query key — it is the prefix the other two share, so one
// invalidation covers the catalogue (like counts) and the liked list at once.
export const SONG_KEYS = {
  all: ['songs'] as const,
  list: ['songs', 'list'] as const,
  liked: ['songs', 'liked'] as const,
  browse: ['songs', 'browse'] as const,
  page: (page: number) => ['songs', 'page', page] as const,
};

const PAGE_SIZE = 20;

/** Rows per page on `/songs`. Ten fits a laptop viewport without scrolling. */
export const SONGS_PER_PAGE = 10;

// ============== QUERIES ==============

/**
 * The catalogue, one page at a time.
 *
 * The home screen and the player queue read the same cache entry, so scrolling
 * further down the list also lengthens the queue that next/previous walk, and
 * neither one pays for a second copy of page 1.
 */
export function useSongsInfinite() {
  const { getSongs } = useSongApi();

  return useInfiniteQuery({
    queryKey: SONG_KEYS.list,
    queryFn: ({ pageParam }) => getSongs({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: last => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * One numbered page of the catalogue, for `/songs`.
 *
 * A separate cache entry from `useSongsInfinite`, not a slice of it: that one is
 * keyed by 20-row pages and grows only forward, so serving page 7 of a 10-row
 * pager from it would mean fetching — and holding — every row up to 70 just to
 * show ten. This asks the server for exactly the ten it draws.
 *
 * `placeholderData: keepPreviousData` keeps the previous page's rows on screen
 * while the next one is in flight. Without it every page change unmounts the
 * list into the loading skeleton, so the whole page height collapses and the
 * pager jumps up the screen under the cursor that just clicked it.
 */
export function useSongsPage(page: number) {
  const { getSongs } = useSongApi();

  return useQuery({
    queryKey: SONG_KEYS.page(page),
    queryFn: () => getSongs({ page, limit: SONGS_PER_PAGE }),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    refetchOnWindowFocus: false,
  });
}

type SongBrowseFilter = { artist: string } | { album: string } | { movie: string };

/**
 * The singer/album/movie browse pages — same catalogue endpoint as
 * `useSongsInfinite`, filtered server-side to one artist/album/movie name.
 * `enabled` guards against firing with an empty name while a dynamic route
 * param is still resolving.
 */
export function useSongsByFilter(filter: SongBrowseFilter) {
  const { getSongs } = useSongApi();
  const value =
    'artist' in filter ? filter.artist : 'album' in filter ? filter.album : filter.movie;

  return useInfiniteQuery({
    queryKey: [...SONG_KEYS.browse, filter],
    queryFn: ({ pageParam }) => getSongs({ page: pageParam, limit: PAGE_SIZE, ...filter }),
    initialPageParam: 1,
    getNextPageParam: last => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    enabled: Boolean(value),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

/**
 * Every song the signed-in caller has liked. Drives both the `/liked` page and
 * the heart in the player, so it is the one source of truth for "is this liked".
 */
export function useLikedSongs(enabled = true) {
  const { getLikedSongs } = useSongApi();

  return useQuery({
    queryKey: SONG_KEYS.liked,
    queryFn: getLikedSongs,
    enabled,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

// ============== MUTATIONS ==============

export function useSongMutations() {
  const queryClient = useQueryClient();
  const { likeSong, unlikeSong } = useSongApi();

  /**
   * Move the song in or out of the cached liked list before the request leaves,
   * and hand the old list back so `onError` can put it there again. A heart that
   * waits for a round-trip reads as a dead button.
   */
  const applyOptimistically = async (song: SongWithRelations, liked: boolean) => {
    await queryClient.cancelQueries({ queryKey: SONG_KEYS.liked });
    const previous = queryClient.getQueryData<SongWithRelations[]>(SONG_KEYS.liked);

    queryClient.setQueryData<SongWithRelations[]>(SONG_KEYS.liked, current => {
      const rest = (current ?? []).filter(entry => entry.id !== song.id);
      return liked ? [song, ...rest] : rest;
    });

    return { previous };
  };

  const rollback = (context: { previous?: SongWithRelations[] } | undefined) => {
    if (context?.previous) {
      queryClient.setQueryData(SONG_KEYS.liked, context.previous);
    }
  };

  // The like count on every card changed too, so this refetches the catalogue
  // as well — `all` is the prefix of both keys.
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
  };

  /**
   * Like a song. Takes the whole song, not just its id, because the optimistic
   * update has to put a renderable row into the liked list.
   */
  const likeSongMutation = useMutation({
    mutationFn: (song: SongWithRelations) => likeSong({ songId: song.id }),
    onMutate: song => applyOptimistically(song, true),
    onError: (_error, _song, context) => rollback(context),
    onSettled: settle,
  });

  /**
   * Unlike a song
   */
  const unlikeSongMutation = useMutation({
    mutationFn: (song: SongWithRelations) => unlikeSong({ songId: song.id }),
    onMutate: song => applyOptimistically(song, false),
    onError: (_error, _song, context) => rollback(context),
    onSettled: settle,
  });

  return {
    likeSongMutation,
    unlikeSongMutation,
  };
}
