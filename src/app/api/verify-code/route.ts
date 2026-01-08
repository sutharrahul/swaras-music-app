/**
 * DEPRECATED: This route is no longer used.
 * Authentication is now handled by Clerk.
 * Email verification is managed by Clerk automatically.
 * This file can be safely deleted.
 */

import { ApiResponce } from '@/app/utils/ApiResponse';

export async function POST(request: Request) {
  return ApiResponce.error('This endpoint is deprecated. Email verification is handled by Clerk.', 410);
}
