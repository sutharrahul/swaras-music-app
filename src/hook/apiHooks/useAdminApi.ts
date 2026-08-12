import { useApiClient } from './useApiClient';
import { useCallback } from 'react';
import type { SongWithRelations } from '@/types/models';

const ADMIN_ROUTE = {
  DELETE_SONG: '/api/admin/delete-song',
  UPDATE_SONG: '/api/admin/update-song',
};

/** Whatever metadata fields the admin is filling in — `songId` says which row. */
export type UpdateSongPayload = {
  songId: string;
  title?: string;
  artist?: string[];
  composers?: string[];
  album?: string | null;
  movie?: string | null;
  genre?: string | null;
  lyrics?: string | null;
};

export default function useAdminApi() {
  const { del, patch } = useApiClient();

  const deleteSong = useCallback(
    async (songId: string) => {
      const response = await del(ADMIN_ROUTE.DELETE_SONG, {
        data: { songId },
      });
      return response.data;
    },
    [del]
  );

  const updateSong = useCallback(
    async (payload: UpdateSongPayload): Promise<SongWithRelations> => {
      const response = await patch(ADMIN_ROUTE.UPDATE_SONG, payload);
      return response.data.data.song;
    },
    [patch]
  );

  return {
    deleteSong,
    updateSong,
  };
}
