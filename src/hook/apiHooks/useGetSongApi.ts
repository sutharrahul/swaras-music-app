import { useCallback } from 'react';
import { useApiClient } from './useApiClient';

export function useGetSongApi() {
  const { get } = useApiClient();

  const getSongs = useCallback(async () => {
    const response = await get('/api/get-songs');
    return response.data;
  }, [get]);

  return { getSongs };
}
