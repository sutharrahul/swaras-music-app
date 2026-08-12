import { useApiClient } from './useApiClient';
import { useCallback } from 'react';

const ARTIST_ROUTE = {
  LIST: '/api/artists',
  ADMIN_PROFILE: '/api/admin/artist-profile',
  PROFILE: '/api/artists/profile',
  PHOTO: '/api/admin/artist-photo',
};

/**
 * One card in the rail/grid. There is no artist table row behind every name —
 * artists are derived from `songs.artist`, so `songCount` moves whenever a song
 * is deleted or re-tagged, and `imageUrl` is null until an admin uploads one.
 */
export type ArtistSummary = { name: string; songCount: number; imageUrl: string | null };

/** The `{ items, pagination }` payload the artist list endpoint returns. */
export type ArtistsPage = {
  artists: ArtistSummary[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
};

/** What the banner needs and nothing more — no song count, no page of tracks. */
export type ArtistProfile = { name: string; bio: string | null; imageUrl: string | null };

export type SaveArtistProfilePayload = { name: string; bio: string | null };

export type MintArtistPhotoPayload = { name: string; contentType: string };
export type MintedArtistPhoto = { artistId: string; photoId: string; bucket: string; path: string };
export type ConfirmArtistPhotoPayload = { artistId: string; photoId: string; contentType: string };

export default function useArtistApi() {
  const { get, post, patch, del } = useApiClient();

  const getArtists = useCallback(
    async ({ page, limit }: { page: number; limit: number }): Promise<ArtistsPage> => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const response = await get(`${ARTIST_ROUTE.LIST}?${params.toString()}`);
      return response.data.data;
    },
    [get]
  );

  /**
   * The name is the identifier — it comes off a route segment, so it is whatever
   * the ID3 tag said: `AC/DC`, `Simon & Garfunkel`, `? and the Mysterians`. It
   * has to be percent-encoded or the `/`, `&` and `?` are read as URL syntax and
   * the server sees a different (or truncated) artist.
   *
   * The route answers 200 with `imageUrl: null` for an artist that has no photo,
   * so a missing image is never an error the banner has to branch on.
   */
  const getArtistProfile = useCallback(
    async (name: string): Promise<ArtistProfile> => {
      const response = await get(`${ARTIST_ROUTE.PROFILE}?name=${encodeURIComponent(name)}`);
      return response.data.data.artist;
    },
    [get]
  );

  /**
   * Step one of a photo upload: the server derives the object path and hands
   * back the bucket to write into. The path is never client-chosen — the same
   * rule the song upload flow follows.
   */
  const mintArtistPhoto = useCallback(
    async (payload: MintArtistPhotoPayload): Promise<MintedArtistPhoto> => {
      const response = await post(ARTIST_ROUTE.PHOTO, payload);
      return response.data.data;
    },
    [post]
  );

  /**
   * Step two: the object is in Storage, point the row at it. Until this lands the
   * upload is invisible — nothing reads a photo the server has not confirmed.
   */
  const confirmArtistPhoto = useCallback(
    async (payload: ConfirmArtistPhotoPayload): Promise<ArtistProfile> => {
      const response = await patch(ARTIST_ROUTE.PHOTO, payload);
      return response.data.data.artist;
    },
    [patch]
  );

  /**
   * Clear an artist's photo. Keyed by name, like the mint step — the list is
   * derived from `songs.artist` and carries no row id. Idempotent server-side,
   * so a double-click is not an error.
   *
   * `del` sends the body under `data`, which is axios's shape for a DELETE with
   * a payload — the same call style `useAdminApi.deleteSong` uses.
   */
  const removeArtistPhoto = useCallback(
    async (name: string): Promise<ArtistProfile> => {
      const response = await del(ARTIST_ROUTE.PHOTO, { data: { name } });
      return response.data.data.artist;
    },
    [del]
  );

  /** Write the artist's bio. Upserts the profile row, so a first-time save works. */
  const saveArtistProfile = useCallback(
    async (payload: SaveArtistProfilePayload): Promise<ArtistProfile> => {
      const response = await patch(ARTIST_ROUTE.ADMIN_PROFILE, payload);
      return response.data.data.artist;
    },
    [patch]
  );

  return {
    getArtists,
    saveArtistProfile,
    getArtistProfile,
    mintArtistPhoto,
    confirmArtistPhoto,
    removeArtistPhoto,
  };
}
