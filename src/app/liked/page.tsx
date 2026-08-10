'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Loader2 } from 'lucide-react';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { useLikedSongs } from '@/hook/query';
import PlayList from '@/components/PlayList';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';

export default function LikedSongsPage() {
  const { user, isLoaded } = useSupabaseUser();
  const router = useRouter();

  // The same `['songs', 'liked']` entry the player's heart reads, so liking the
  // track that is playing shows up here without a refetch, and unliking a row
  // here empties the heart in the bar.
  const { data: songs = [], isLoading, isError, refetch } = useLikedSongs(!!user);

  useEffect(() => {
    if (isLoaded && !user) {
      router.replace('/sign-in');
    }
  }, [user, isLoaded, router]);

  if (!isLoaded || isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading liked songs"
        className="flex items-center justify-center h-full"
      >
        <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Heart aria-hidden="true" className="w-8 h-8 text-brand fill-brand" />
          Liked Songs
        </h1>
        <p className="text-muted-foreground">
          {songs.length} song{songs.length !== 1 ? 's' : ''} you have hearted
        </p>
      </div>

      {isError ? (
        <ErrorState
          title="We could not load your liked songs"
          description="The request failed on the way out. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : songs.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No liked songs yet"
          description="Tap the heart in the player to keep a track here."
        />
      ) : (
        <PlayList songData={songs} dataType="allsong" />
      )}
    </div>
  );
}
