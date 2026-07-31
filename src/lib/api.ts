/**
 * Shared route-handler plumbing: request validation, pagination clamping and
 * PostgREST error mapping.
 */

import { ApiResponse } from '@/app/utils/ApiResponse';
import type { PostgrestError } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * `?limit=999999` used to dump the whole table. The clamp lives in the schema,
 * not in each handler, so it cannot be forgotten in one of them.
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function parsePagination(url: string) {
  const { searchParams } = new URL(url);
  return paginationSchema.safeParse({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
}

/** First zod issue, formatted for a 400 the client can act on. */
export function validationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * PostgREST/Postgres error codes that mean something specific to a client.
 * Everything else is a 500 with a fixed message — an exception message is never
 * echoed back, because it can carry column names, constraint names and row
 * values.
 */
export function respondToDbError(error: PostgrestError, fallbackMessage: string): Response {
  switch (error.code) {
    // `.single()` matched zero rows (or more than one).
    case 'PGRST116':
      return ApiResponse.error('Not found', 404);
    case '23505':
      return ApiResponse.error('That record already exists', 409);
    case '23503':
      return ApiResponse.error('Referenced record does not exist', 404);
    case '23514':
      return ApiResponse.error('Invalid value for one of the fields', 400);
    // RLS refused the row, or the role lacks the table grant.
    case '42501':
      return ApiResponse.error('Forbidden', 403);
    default:
      console.error(`${fallbackMessage}:`, error);
      return ApiResponse.error(fallbackMessage, 500);
  }
}

/**
 * R7 — never let a shared cache hold a per-user response. `/api/search` in
 * particular mixes the public catalogue with the caller's own playlists.
 */
export function privateNoStore(response: Response): Response {
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
