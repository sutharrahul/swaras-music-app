import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholder for a `Shelf`. The card geometry mirrors `SongCard` (square art,
 * title, artist) so the rail does not resize when the songs land.
 */
export default function ShelfSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div aria-hidden="true" className="mb-8">
      <Skeleton className="mb-3 ml-2 h-6 w-40 md:ml-8" />
      <div className="flex gap-4 overflow-hidden px-2 pb-2 md:px-8">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="w-40 flex-none rounded-lg bg-card p-2.5">
            <Skeleton className="aspect-square w-full rounded-md" />
            <Skeleton className="mt-2.5 h-4 w-3/4" />
            <Skeleton className="mt-1.5 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
