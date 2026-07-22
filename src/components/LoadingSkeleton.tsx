import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholder for the song list. The geometry deliberately mirrors a real row
 * in `PlayList` (cover, title/artist/album grid, duration, like count, actions)
 * so nothing jumps when the data lands.
 */
export default function LoadingSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="space-y-1 px-2 md:px-8" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <li key={index} className="flex items-center justify-between px-2 py-1.5">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            <Skeleton className="w-9 h-9 md:w-10 md:h-10 rounded flex-shrink-0" />

            <div className="flex flex-col gap-2 md:grid md:grid-cols-3 md:gap-4 md:flex-1 min-w-0 w-full">
              <Skeleton className="h-3 w-40 md:w-48" />
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24 hidden md:block" />
            </div>

            <Skeleton className="h-3 w-10 mx-3 hidden md:block" />
          </div>

          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-6 w-6 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}
