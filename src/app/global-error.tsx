'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Replaces the root layout entirely, so it has to ship its own <html>/<body>
 * and cannot depend on any provider above it.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="h-dvh">
      <body className="antialiased bg-background text-foreground h-dvh">
        <main
          role="alert"
          className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center"
        >
          <h1 className="text-2xl font-bold">Something went badly wrong</h1>
          <p className="max-w-md text-muted-foreground">
            SwarasMusic could not recover on its own. Reloading usually clears it.
          </p>
          <button
            onClick={reset}
            className="rounded-lg bg-primary hover:bg-primary/90 px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Reload the app
          </button>
        </main>
      </body>
    </html>
  );
}
