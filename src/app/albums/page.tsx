'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Disc3, Loader2 } from 'lucide-react';
import AlbumCard from '@/components/AlbumCard';
import ShelfSkeleton from '@/components/states/ShelfSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import { useAlbumsInfinite } from '@/hook/query';

/**
 * The full album grid, reached from the home rail's "Show all".
 *
 * No back button, unlike `/album/[name]`: this is a top-level destination, not a
 * drill-down, so `router.back()` would point at wherever the user happened to
 * come from rather than at a parent. Same reasoning as `/artists`.
 */
export default function AlbumsPage() {
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useAlbumsInfinite();

  const albums = useMemo(() => data?.pages.flatMap(page => page.albums) ?? [], [data]);

  // The server's total, not `albums.length` — the latter counts only the pages
  // fetched so far, so under infinite scroll the subline would start at 24 and
  // climb as the reader scrolls, which reads as a bug rather than as a count.
  const total = data?.pages[0]?.pagination.total ?? albums.length;

  const observerTarget = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">Albums</h1>
        {!isLoading && !isError && (
          <p className="text-muted-foreground/70">
            {total} album{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {isLoading ? (
        // The rail skeleton stands in for the grid: same card geometry, and one
        // scrolling row of placeholders is honest about how little is known yet.
        // No `circular` — album art is square, so the default is already right.
        <ShelfSkeleton />
      ) : isError ? (
        <ErrorState
          title="We could not load the albums"
          description="The request failed on the way out. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : albums.length === 0 ? (
        <EmptyState
          icon={Disc3}
          title="No albums yet"
          description="Albums appear here once songs are tagged with one."
        />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {albums.map(album => (
              <li key={album.name}>
                <AlbumCard album={album} />
              </li>
            ))}
          </ul>

          {/* Infinite Scroll Trigger */}
          {hasNextPage && (
            <div ref={observerTarget} className="flex justify-center py-8">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
                  <span>Loading more albums...</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
