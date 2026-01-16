'use client';

import React, { useState, useEffect, useRef } from 'react';
import PlayList from '@/components/PlayList';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const [songs, setSongs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
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

  return (
    <div className="flex flex-col justify-between items-center h-full py-8 px-4">
      <div className="w-full h-full">
        {loading ? (
          <>
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
          </>
        ) : error ? (
          <p className="flex items-center justify-center text-center text-lg font-bold h-full">
            {error}
          </p>
        ) : (
          <>
            <PlayList songData={songs} dataType="allsong" />

            {/* Infinite Scroll Trigger */}
            {hasMore && (
              <div ref={observerTarget} className="flex justify-center py-8">
                {loadingMore && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Loading more songs...</span>
                  </div>
                )}
              </div>
            )}

            {!hasMore && songs.length > 0 && (
              <p className="text-center text-gray-400 py-8">You&apos;ve reached the end!</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
