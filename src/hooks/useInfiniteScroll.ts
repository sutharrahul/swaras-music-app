'use client';

import { useEffect, useRef } from 'react';

/**
 * Fetches the next page when a sentinel element scrolls into view.
 *
 * `/artists` and `/albums` carried byte-identical copies of this effect. It is
 * an observer rather than a scroll listener for the usual reason: it fires only
 * on the crossing instead of on every scroll frame, and needs no threshold tied
 * to the page's height.
 *
 * Returns the ref to put on the sentinel — render it only while `hasNextPage`,
 * so a fully-loaded list has nothing left to trip the observer.
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    // Captured once: the cleanup has to unobserve the same node the effect
    // observed, and `sentinelRef.current` may already point elsewhere by then.
    const target = sentinelRef.current;
    if (target) observer.observe(target);

    return () => {
      if (target) observer.unobserve(target);
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return sentinelRef;
}
