import { useMemo } from 'react';
import { AxiosRequestConfig } from 'axios';
import { axiosInstance } from '@/utils/axios/axios';

/**
 * Thin wrapper over the shared axios instance.
 *
 * The Clerk bearer token is gone and nothing replaces it. Every endpoint here is
 * same-origin, so the browser attaches the Supabase auth cookies on its own and
 * the server reads the session from them via `@supabase/ssr`. Putting the access
 * token in an `Authorization` header would be strictly worse: it is readable
 * from JavaScript, it went through the logging interceptor on every request
 * (which is how the token ended up in the browser console), and it cannot be
 * rotated by the middleware the way an httpOnly cookie can.
 *
 * The methods no longer close over anything, so they are stable for the lifetime
 * of the hook — `useMemo` keeps the object identity stable too, which matters
 * because these land in TanStack Query `queryFn` deps.
 */
export function useApiClient() {
  return useMemo(
    () => ({
      get: (url: string, config: AxiosRequestConfig = {}) => axiosInstance.get(url, config),
      post: (url: string, data?: unknown, config: AxiosRequestConfig = {}) =>
        axiosInstance.post(url, data, config),
      patch: (url: string, data?: unknown, config: AxiosRequestConfig = {}) =>
        axiosInstance.patch(url, data, config),
      del: (url: string, config: AxiosRequestConfig = {}) => axiosInstance.delete(url, config),
    }),
    []
  );
}
