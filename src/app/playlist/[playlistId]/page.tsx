'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Loader2, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlayList from '@/components/PlayList';

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
  const { user, isLoaded } = useUser();
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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#B40000]" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Music2 className="w-16 h-16 text-gray-600 mb-4" />
        <p className="text-gray-400 text-lg">Playlist not found</p>
        <Button
          onClick={() => router.push('/playlist')}
          className="mt-4 bg-gradient-to-r from-[#800000] to-[#B40000]"
        >
          Back to Playlists
        </Button>
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
          className="mb-4 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Playlists
        </Button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">{playlist.name}</h1>
            <p className="text-gray-500">
              {playlist.playlistSongs.length} song{playlist.playlistSongs.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Songs List */}
      {songs.length === 0 ? (
        <div className="text-center py-20">
          <Music2 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No songs in this playlist</h3>
          <p className="text-gray-500">Add songs from the home page to build your playlist</p>
        </div>
      ) : (
        <PlayList songData={songs} dataType="userPlaylist" />
      )}
    </div>
  );
}
