import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholder for a `Shelf`. The card geometry mirrors `SongCard` (square art,
 * title, artist) so the rail does not resize when the songs land.
 *
 * `circular` switches it to `ArtistShelf` geometry — round art and centred text
 * — for the same reason: an artist rail that swapped a square for a circle on
 * load would visibly jump.
 */
export default function ShelfSkeleton({
  cards = 6,
  circular = false,
}: {
  cards?: number;
  circular?: boolean;
}) {
  return (
    <div aria-hidden="true" className="mb-8">
      <Skeleton className="mb-3 ml-2 h-6 w-40 md:ml-8" />
      <div className="flex gap-4 overflow-hidden px-2 pb-2 md:px-8">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="w-40 flex-none rounded-lg bg-card p-2.5">
            <Skeleton
              className={`aspect-square w-full ${circular ? 'rounded-full' : 'rounded-md'}`}
            />
            <Skeleton className={`mt-2.5 h-4 w-3/4 ${circular ? 'mx-auto' : ''}`} />
            <Skeleton className={`mt-1.5 h-3 w-1/2 ${circular ? 'mx-auto' : ''}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
