'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import ErrorState from '@/components/states/ErrorState';

export default function PlaylistDetailError({
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
    <div className="p-6 max-w-7xl mx-auto">
      <ErrorState
        title="We could not load this playlist"
        description="It may have been deleted, or the request simply failed."
        onRetry={reset}
        action={
          <Link
            href="/playlist"
            className="rounded-lg bg-secondary px-5 py-2.5 text-sm font-medium text-foreground"
          >
            Back to playlists
          </Link>
        }
      />
    </div>
  );
}
