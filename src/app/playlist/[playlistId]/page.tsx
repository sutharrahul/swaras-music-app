'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { ArrowLeft, Loader2, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlayList from '@/components/PlayList';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import { usePlaylist } from '@/hook/query';

export default function PlaylistDetailPage() {
  const { user, isLoaded } = useSupabaseUser();
  const router = useRouter();
  const params = useParams();
  const playlistId = params.playlistId as string;

  // Removing a song from this playlist invalidates `['playlists','detail',id]`,
  // which is what re-renders the list — it used to be a full document reload,
  // and that took the audio element with it.
  const {
    data: playlist,
    isLoading,
    isError,
    error,
    refetch,
  } = usePlaylist(playlistId, !!user);

  useEffect(() => {
    if (isLoaded && !user) {
      router.replace('/sign-in');
    }
  }, [user, isLoaded, router]);

  if (!isLoaded || isLoading) {
    return (
      <div
        role="status"
        aria-label="Loading playlist"
        className="flex items-center justify-center h-full"
      >
        <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  // A playlist that is not yours comes back 404, deliberately — see the route
  // handler. "Not found" and "not yours" must look identical here too.
  const notFound = isError && (error as { response?: { status?: number } })?.response?.status === 404;

  if (isError && !notFound) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <ErrorState
          title="We could not load this playlist"
          description="The request failed on the way out. Try again in a moment."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <EmptyState
          icon={Music2}
          title="Playlist not found"
          description="It may have been deleted, or it never belonged to this account."
          action={
            <Button onClick={() => router.push('/playlist')} className="bg-brand-gradient">
              Back to Playlists
            </Button>
          }
        />
      </div>
    );
  }

  const songs = playlist.playlistSongs.map(ps => ps.song);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Button
          onClick={() => router.push('/playlist')}
          variant="ghost"
          className="mb-4 text-muted-foreground hover:text-white"
        >
          <ArrowLeft aria-hidden="true" className="w-4 h-4 mr-2" />
          Back to Playlists
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{playlist.name}</h1>
            <p className="text-muted-foreground/70">
              {playlist.playlistSongs.length} song{playlist.playlistSongs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Songs List */}
      {songs.length === 0 ? (
        <EmptyState
          icon={Music2}
          title="No songs in this playlist"
          description="Add songs from the home page to build your playlist"
        />
      ) : (
        <PlayList songData={songs} dataType="userPlaylist" playlistId={playlist.id} />
      )}
    </div>
  );
}
