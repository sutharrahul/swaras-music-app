import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';
import useArtistApi from '../apiHooks/useArtistApi';

// `all` is nobody's query key — it is the prefix that `list` and every
// `profile(name)` share. That is the whole point: a photo upload changes what
// four separate screens draw (the home rail, the /artists grid, the admin table
// and the /artist/[name] banner), and one invalidation on this prefix refreshes
// all of them without the mutation needing to know which are mounted.
//
// Every invalidation of this prefix MUST pass `refetchType: 'all'`. The default
// is `'active'`, which only *marks* an unmounted query invalidated and leaves
// the refetch to the next mount — and this app sets `refetchOnMount: false`
// globally (`src/components/Providers.tsx`) to stop reload flashes, so that
// refetch never comes. The flagged entry then serves stale data until gcTime
// evicts it 10 minutes later. That combination silently defeats the paragraph
// above: the upload happens on /admin, so the /artist/[name] banner — the one
// surface this feature exists to change — is never mounted when it fires.
//
// No user id here either, for the reason spelled out at the top of
// `useSongQueries.ts`: these responses are not user-scoped at all, and a key
// naming a user would only invite the cache to survive a sign-out.
export const ARTIST_KEYS = {
  all: ['artists'] as const,
  list: ['artists', 'list'] as const,
  profile: (name: string) => ['artists', 'profile', name] as const,
};

const PAGE_SIZE = 24;

// ============== QUERIES ==============

/**
 * Every artist, one page at a time.
 *
 * Three consumers deliberately share this single cache entry — the home rail,
 * the /artists grid and the admin photo panel all read `ARTIST_KEYS.list`. So
 * the rail's first page is already warm when the user opens the full grid, and
 * moving between the three costs zero refetches; only scrolling past the end of
 * what is cached hits the network.
 */
export function useArtistsInfinite() {
  const { getArtists } = useArtistApi();

  return useInfiniteQuery({
    queryKey: ARTIST_KEYS.list,
    queryFn: ({ pageParam }) => getArtists({ page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: last => (last.pagination.hasMore ? last.pagination.page + 1 : undefined),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

/**
 * One artist's banner (name + photo). The name arrives from a dynamic route
 * segment, so `enabled` keeps this from firing with an empty string while that
 * param is still resolving — same guard as `useSongsByFilter`.
 */
export function useArtistProfile(name: string) {
  const { getArtistProfile } = useArtistApi();

  return useQuery({
    queryKey: ARTIST_KEYS.profile(name),
    queryFn: () => getArtistProfile(name),
    enabled: Boolean(name),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes cache
  });
}

// ============== MUTATIONS ==============

export function useArtistMutations() {
  const queryClient = useQueryClient();
  const { mintArtistPhoto, confirmArtistPhoto, removeArtistPhoto, saveArtistProfile } =
    useArtistApi();

  /**
   * Give an artist a photo: mint → upload → confirm, all inside one mutation so
   * the panel has a single pending flag to disable the button on, instead of
   * three states it would have to compose by hand.
   *
   * **The bytes never touch a route handler.** The admin's own browser session
   * writes straight to Storage and the `artist_images_insert_admin` RLS policy
   * is what authorizes the write — the server's only jobs are minting the path
   * and confirming the result. This is not a preference: a Vercel request body
   * caps around 4.5MB, so a 10MB photo could not fit through `/api` at all.
   */
  const uploadArtistPhotoMutation = useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const contentType = file.type;
      const mint = await mintArtistPhoto({ name, contentType });

      // Built here rather than at module scope: the client reads the auth
      // cookies when it is constructed, and one created at import time would
      // still be holding the session of whoever was signed in back then.
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(mint.bucket)
        .upload(mint.path, file, { contentType, upsert: true });

      if (error) {
        // No orphan sweep exists for this bucket, so clean up here. Only safe
        // BEFORE confirm; after it, the row may already point at this object.
        await supabase.storage.from(mint.bucket).remove([mint.path]);
        throw error;
      }

      return confirmArtistPhoto({ artistId: mint.artistId, photoId: mint.photoId, contentType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARTIST_KEYS.all, refetchType: 'all' });
    },
    // No `onError` — toasts and per-panel recovery belong to the call site, the
    // same way every other mutation in this folder is wired.
  });

  /**
   * Clear an artist's photo. One request, unlike the upload — the bytes are the
   * server's to delete here, so there is no browser-direct step and nothing to
   * mint. Same `refetchType: 'all'`, for the same reason: the surface most
   * likely to be stale (`/artist/[name]`) is not mounted when this fires.
   */
  const removeArtistPhotoMutation = useMutation({
    mutationFn: (name: string) => removeArtistPhoto(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARTIST_KEYS.all, refetchType: 'all' });
    },
  });

  /**
   * Save the bio. Invalidates the same prefix as the photo mutations — the
   * `/artist/[name]` banner reads its bio from `ARTIST_KEYS.profile(name)`,
   * which is NOT mounted while the admin is editing, hence `refetchType: 'all'`.
   */
  const saveArtistProfileMutation = useMutation({
    mutationFn: saveArtistProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ARTIST_KEYS.all, refetchType: 'all' });
    },
  });

  return {
    uploadArtistPhotoMutation,
    saveArtistProfileMutation,
    removeArtistPhotoMutation,
  };
}
