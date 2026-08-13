'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Loader2, Music } from 'lucide-react';
import PlayList from '@/components/PlayList';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import { useSongsInfinite } from '@/hook/query';

/**
 * The whole catalogue, reached from the home page's "All songs → Show all".
 *
 * The infinite scroll used to live on the home page itself, which meant a
 * hundred-track catalogue turned the front page into a hundred-row wall: the
 * shelves and the artist/album rails above it became things you scrolled *past*
 * rather than the point of the page. The list moved here so home can stay a
 * short digest, the same split `/artists` and `/albums` already use.
 *
 * `useSongsInfinite()` is the same cache entry the home page and the player
 * queue read, so arriving here does not refetch page 1 — it continues from
 * whatever home already loaded, and every page loaded here is a page the
 * player's next/previous can walk.
 *
 * No back button, matching `/artists` and `/albums`: this is a top-level
 * destination, so `router.back()` would point at wherever the reader came from
 * rather than at a parent.
 */
export default function SongsPage() {
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSongsInfinite();

  const songs = useMemo(() => data?.pages.flatMap(page => page.songs) ?? [], [data]);

  // The server's total, not `songs.length`: the latter counts only the pages
  // fetched so far, so the subline would start at 20 and climb as the reader
  // scrolls, which reads as a bug rather than as a count.
  const total = data?.pages[0]?.pagination.total ?? songs.length;

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
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">All songs</h1>
        {!isLoading && !isError && (
          <p className="text-muted-foreground/70">
            {total} song{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <ErrorState
          title="We could not load the songs"
          description="The request failed on the way out. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : songs.length === 0 ? (
        <EmptyState
          icon={Music}
          title="No songs yet"
          description="Songs appear here once an admin uploads them."
        />
      ) : (
        <>
          <PlayList songData={songs} dataType="allsong" showIndex />

          {/* Infinite Scroll Trigger */}
          {hasNextPage && (
            <div ref={observerTarget} className="flex justify-center py-8">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
                  <span>Loading more songs...</span>
                </div>
              )}
            </div>
          )}

          {!hasNextPage && (
            <p className="text-center text-muted-foreground py-8">You&apos;ve reached the end!</p>
          )}
        </>
      )}
    </div>
  );
}
