import { type NextRequest } from 'next/server';

import { updateSession } from '@/utils/supabase/middleware';

/**
 * `updateSession` does two things that must not be separated: it refreshes the
 * Supabase auth cookies, and it applies deny-by-default route protection (R2).
 * The stock Supabase middleware only does the first; dropping that in on its own
 * would turn every handler that used to sit behind Clerk's `auth.protect()` into
 * an anonymous public endpoint.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
