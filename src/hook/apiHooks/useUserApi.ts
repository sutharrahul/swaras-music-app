import { useCallback } from 'react';
import { useApiClient } from './useApiClient';

const USER_ROUTE = {
  CHECK_ADMIN: '/api/check-admin',
};

export default function useUserApi() {
  const { get } = useApiClient();

  const checkAdminStatus = useCallback(async () => {
    try {
      const response = await get(USER_ROUTE.CHECK_ADMIN);
      return response.data;
    } catch (error) {
      console.error('Error checking admin status:', error);
      throw error;
    }
  }, [get]);

  return {
    checkAdminStatus,
  };
}
