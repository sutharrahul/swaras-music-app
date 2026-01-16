import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes - accessible to everyone (authenticated or not)
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in',
  '/sign-up',
  '/api/webhooks/clerk',
  '/api/get-songs',
  '/api/search',
]);

// Admin-only routes
const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/upload-song', '/api/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Redirect logged-in users away from auth pages
  if (userId) {
    const isAuthRoute = req.nextUrl.pathname === '/sign-in' || req.nextUrl.pathname === '/sign-up';

    if (isAuthRoute) {
      const homeUrl = new URL('/', req.url);
      return NextResponse.redirect(homeUrl);
    }
  }

  // Protect admin routes - require authentication and admin role
  if (isAdminRoute(req)) {
    await auth.protect();
    // Note: Additional admin role check is done in the route handlers
  }

  // Protect all other non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
