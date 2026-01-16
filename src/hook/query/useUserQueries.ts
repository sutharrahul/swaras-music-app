import { useQuery } from '@tanstack/react-query';
import useUserApi from '../apiHooks/useUserApi';

export function useUserQueries() {
  const { checkAdminStatus } = useUserApi();

  /**
   * Check if the current user is an admin
   */
  const useCheckAdmin = () => {
    return useQuery({
      queryKey: ['admin-status'],
      queryFn: checkAdminStatus,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    });
  };

  return {
    useCheckAdmin,
  };
}
