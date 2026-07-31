'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlayList from '@/components/PlayList';
import EmptyState from '@/components/states/EmptyState';

interface PlaylistDetails {
  id: string;
  name: string;
  description?: string;
  playlistSongs: Array<{
    id: string;
    song: any;
  }>;
}

export default function PlaylistDetailPage() {
  const { user, isLoaded } = useSupabaseUser();
  const router = useRouter();
  const params = useParams();
  const playlistId = params.playlistId as string;

  const [playlist, setPlaylist] = useState<PlaylistDetails | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPlaylist = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`/api/playlists/${playlistId}`);
      if (data?.success) {
        setPlaylist(data.data);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Failed to load playlist');
      }
      console.error('Error loading playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && !user) {
      router.replace('/sign-in');
      return;
    }

    if (user && playlistId) {
      loadPlaylist();
    }
  }, [user, isLoaded, playlistId, router]);

  if (!isLoaded || loading) {
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
