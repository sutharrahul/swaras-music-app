import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher(['/sign-in', '/sign-up', '/']);

// This is an ASYNC function
export default clerkMiddleware(async (auth, req) => {
  // 1. You MUST AWAIT the auth() call to get the auth state
  const { userId } = await auth(); // <-- This is the fix

  // 2. Logic for LOGGED-IN users
  if (userId) {
    // Redirect signed-in users away from sign-in and sign-up pages
    const isAuthRoute =
      req.nextUrl.pathname === '/sign-in' ||
      req.nextUrl.pathname === '/sign-up';

    if (isAuthRoute) {
      const dashboardUrl = new URL('/dashboard', req.url);
      return NextResponse.redirect(dashboardUrl);
    }
    // Allow signed-in users to visit home route ('/') and other routes
  }

  // 3. Logic for LOGGED-OUT users
  if (!isPublicRoute(req)) {
    // You also await auth.protect()
    await auth.protect();
  }

  // 4. Allow other requests
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
