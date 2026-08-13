/**
 * Shared helper for the API-hook layer.
 *
 * Deliberately thin. This used to re-export every `useXApi` hook as well, but
 * nothing imported them from here — each query hook pulls its API hook straight
 * from the file next to it (`../apiHooks/useSongApi`), which is one fewer
 * indirection and keeps the two tiers paired. Only `apiErrorMessage` is used
 * across the app, so only that is re-exported.
 */
export { apiErrorMessage } from './useApiClient';
