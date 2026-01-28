import { useQuery } from '@tanstack/react-query';
import useUserApi from '../apiHooks/useUserApi';

export function useUserQueries() {
  const { checkAdminStatus } = useUserApi();

  /**
   * Check if the current user is an admin
   * @param enabled - Only run query when user is signed in
   */
  const useCheckAdmin = (enabled: boolean = false) => {
    return useQuery({
      queryKey: ['admin-status'],
      queryFn: checkAdminStatus,
      enabled: enabled, // Only run when user is signed in
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes cache
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      retry: 1,
    });
  };

  return {
    useCheckAdmin,
  };
}
