import { useApiClient } from './useApiClient';
import { useCallback } from 'react';

const ADMIN_ROUTE = {
  DELETE_SONG: '/api/admin/delete-song',
};

export default function useAdminApi() {
  const { del } = useApiClient();

  const deleteSong = useCallback(
    async (songId: string) => {
      const response = await del(ADMIN_ROUTE.DELETE_SONG, {
        data: { songId },
      });
      return response.data;
    },
    [del]
  );

  return {
    deleteSong,
  };
}
