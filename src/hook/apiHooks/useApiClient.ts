// hooks/useApiClient.ts
import { useAuth } from '@clerk/nextjs';
import { useCallback } from 'react';
import { AxiosRequestConfig } from 'axios';
import { axiosInstance } from '@/utils/axios/axios';

export function useApiClient() {
  const { getToken } = useAuth();

  const get = useCallback(
    async (url: string, config: AxiosRequestConfig = {}) => {
      const token = await getToken();
      return axiosInstance.get(url, {
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [getToken]
  );

  const post = useCallback(
    async (url: string, data?: any, config: AxiosRequestConfig = {}) => {
      const token = await getToken();
      return axiosInstance.post(url, data, {
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [getToken]
  );

  const patch = useCallback(
    async (url: string, data?: any, config: AxiosRequestConfig = {}) => {
      const token = await getToken();
      return axiosInstance.patch(url, data, {
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [getToken]
  );

  const del = useCallback(
    async (url: string, config: AxiosRequestConfig = {}) => {
      const token = await getToken();
      return axiosInstance.delete(url, {
        ...config,
        headers: {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        },
      });
    },
    [getToken]
  );

  // Return the functions so your components can use them
  return { get, post, patch, del };
}
