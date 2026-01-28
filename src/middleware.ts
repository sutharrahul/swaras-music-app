import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Public routes - accessible to everyone (authenticated or not)
const isPublicRoute = createRouteMatcher([
  '/',
  '/api/webhooks/clerk',
  '/api/get-songs',
  '/api/search',
]);

// Auth routes
const isAuthRoute = createRouteMatcher(['/sign-in', '/sign-up']);

// Admin-only routes
const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/upload-song', '/api/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();

  // Redirect logged-in users away from auth pages
  if (userId && isAuthRoute(req)) {
    const homeUrl = new URL('/', req.url);
    return NextResponse.redirect(homeUrl);
  }

  // Allow auth routes for non-authenticated users
  if (isAuthRoute(req)) {
    return NextResponse.next();
  }

  // Allow public routes
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // Protect admin routes - require authentication and admin role
  if (isAdminRoute(req)) {
    await auth.protect();
    // Note: Additional admin role check is done in the route handlers
  } else {
    // Protect all other non-public routes
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
