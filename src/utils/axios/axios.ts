import Axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

/**
 * What this file used to do, on every single request, in production:
 *
 *   - `JSON.stringify(config.headers)` — which included
 *     `Authorization: Bearer <JWT>`, printed to the browser console. Anything
 *     with console access (an extension, a copy-pasted snippet, a screen share)
 *     read the session token straight out of the log.
 *   - `JSON.stringify(response.data)` — every response body, so liked songs,
 *     playlist contents and any error detail were logged too.
 *   - imported `chalk`, which was never a declared dependency (it resolved only
 *     as a transitive install) and whose ANSI codes are meaningless in a browser
 *     console anyway.
 *
 * What replaces it: method, URL, status and duration. No headers, no bodies, no
 * query strings — a search term or a token can ride in one of those. Development
 * only; the interceptors are not even registered in a production build, so this
 * cannot regress into logging on a live site.
 */

const axiosInstance = Axios.create({
  timeout: 1000 * 60,
});

const isDev = process.env.NODE_ENV === 'development';

type TimedConfig = InternalAxiosRequestConfig & { metadata?: { startTime: number } };

/** Path only — the query string can carry a search term or a token. */
const pathOf = (url: string | undefined) => (url ?? '').split('?')[0];

const elapsed = (config: TimedConfig | undefined) => {
  const start = config?.metadata?.startTime;
  return start ? `${Date.now() - start}ms` : '—';
};

if (isDev) {
  axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      (config as TimedConfig).metadata = { startTime: Date.now() };
      return config;
    },
    error => Promise.reject(error)
  );

  axiosInstance.interceptors.response.use(
    (response: AxiosResponse) => {
      const config = response.config as TimedConfig;
      console.debug(
        `[api] ${config.method?.toUpperCase()} ${pathOf(config.url)} → ${response.status} (${elapsed(config)})`
      );
      return response;
    },
    (error: AxiosError) => {
      const config = error.config as TimedConfig | undefined;
      console.debug(
        `[api] ${config?.method?.toUpperCase()} ${pathOf(config?.url)} → ${error.response?.status ?? 'network error'} (${elapsed(config)})`
      );
      return Promise.reject(error);
    }
  );
}

export { axiosInstance };
