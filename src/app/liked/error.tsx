'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/states/ErrorState';

export default function LikedSongsError({
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
        title="We could not load your liked songs"
        description="The request failed on the way out. Try again in a moment."
        onRetry={reset}
      />
    </div>
  );
}
