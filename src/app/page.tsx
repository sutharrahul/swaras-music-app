'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import PlayList from '@/components/PlayList';
import Shelf from '@/components/Shelf';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ShelfSkeleton from '@/components/states/ShelfSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import axios from 'axios';
import { Loader2, Music } from 'lucide-react';

/**
 * Shelf sizing. A rail that does not overflow its container reads as a broken
 * grid rather than a scroller, so a shelf only appears once it holds enough
 * cards to actually scroll. Below that the page falls back to the dense list,
 * which is the right shape for a small library anyway.
 */
const SHELF_MIN = 8;
const SHELF_MAX = 12;

/** Share of the smaller shelf that also appears in the other one. */
const overlapRatio = (a: { id: string }[], b: { id: string }[]) => {
  if (a.length === 0 || b.length === 0) return 0;
  const ids = new Set(a.map(song => song.id));
  return b.filter(song => ids.has(song.id)).length / Math.min(a.length, b.length);
};

export default function Home() {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  // Shelves are frozen to the first page. Re-deriving them as infinite scroll
  // appends pages would reshuffle the cards and shift the list under the reader.
  const [shelfSource, setShelfSource] = useState<any[]>([]);
  const [wholeCatalogLoaded, setWholeCatalogLoaded] = useState(false);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    loadSongs(1);
  }, []);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadSongs(page + 1);
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
  }, [hasMore, loadingMore, loading, page]);

  const loadSongs = async (pageNum: number) => {
    try {
      if (pageNum === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const { data } = await axios.get(`/api/get-songs?page=${pageNum}&limit=20`);

      if (data?.success) {
        const newSongs = data.data.songs;

        if (pageNum === 1) {
          setSongs(newSongs);
          setShelfSource(newSongs);
          setWholeCatalogLoaded(!data.data.pagination.hasMore);
        } else {
          setSongs(prev => [...prev, ...newSongs]);
        }

        setPage(pageNum);
        setHasMore(data.data.pagination.hasMore);
      }
    } catch (err) {
      setError('Failed to load songs');
      console.error('Error loading songs:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const { recentlyAdded, mostLiked } = useMemo(() => {
    // The API already orders by createdAt desc, so page one *is* the newest.
    const recent = shelfSource.length >= SHELF_MIN ? shelfSource.slice(0, SHELF_MAX) : [];

    // "Most liked" is only truthful when the first page held the whole catalog.
    // Ranking a 20-song window by likes would quietly mislabel itself.
    const liked = wholeCatalogLoaded
      ? shelfSource
          .filter(song => (song._count?.likes ?? 0) > 0)
          .sort((a, b) => (b._count?.likes ?? 0) - (a._count?.likes ?? 0))
          .slice(0, SHELF_MAX)
      : [];

    // Two shelves showing mostly the same covers is worse than a single shelf.
    const likedIsDistinct = liked.length >= SHELF_MIN && overlapRatio(recent, liked) <= 0.5;

    return { recentlyAdded: recent, mostLiked: likedIsDistinct ? liked : [] };
  }, [shelfSource, wholeCatalogLoaded]);

  return (
    <div className="w-full py-6">
      {loading ? (
        <>
          <ShelfSkeleton />
          <LoadingSkeleton />
        </>
      ) : error ? (
        <ErrorState
          title="We could not load the songs"
          description={error}
          onRetry={() => loadSongs(1)}
        />
      ) : songs.length === 0 ? (
        <EmptyState
          icon={Music}
          title="No songs yet"
          description="As soon as an admin uploads a track it will appear here."
        />
      ) : (
        <>
          {recentlyAdded.length > 0 && <Shelf title="Recently added" songs={recentlyAdded} />}
          {mostLiked.length > 0 && <Shelf title="Most liked" songs={mostLiked} />}

          <h2 className="mb-3 px-2 text-lg font-bold tracking-tight text-white md:px-8">
            All songs
          </h2>
          <PlayList songData={songs} dataType="allsong" />

          {/* Infinite Scroll Trigger */}
          {hasMore && (
            <div ref={observerTarget} className="flex justify-center py-8">
              {loadingMore && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 aria-hidden="true" className="w-5 h-5 animate-spin" />
                  <span>Loading more songs...</span>
                </div>
              )}
            </div>
          )}

          {!hasMore && songs.length > 0 && (
            <p className="text-center text-muted-foreground py-8">You&apos;ve reached the end!</p>
          )}
        </>
      )}
    </div>
  );
}
