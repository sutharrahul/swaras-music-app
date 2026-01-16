'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Music2, Trash2, ListMusic, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Playlist {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  _count: {
    playlistSongs: number;
  };
}

export default function PlaylistsPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');

  useEffect(() => {
    if (isLoaded && !user) {
      router.replace('/sign-in');
      return;
    }

    if (user) {
      loadPlaylists();
    }
  }, [user, isLoaded, router]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/api/playlists');
      if (data?.success) {
        setPlaylists(data.data);
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
      toast.error('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast.error('Playlist name is required');
      return;
    }

    try {
      setCreating(true);
      const { data } = await axios.post('/api/playlists', {
        name: newPlaylistName,
      });

      if (data?.success) {
        toast.success('Playlist created successfully!');
        setPlaylists(prev => [data.data, ...prev]);
        setNewPlaylistName('');
        setShowCreateForm(false);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Failed to create playlist');
      } else {
        toast.error('Something went wrong');
      }
    } finally {
      setCreating(false);
    }
  };

  const deletePlaylist = async (playlistId: string) => {
    if (!confirm('Are you sure you want to delete this playlist?')) return;

    try {
      const { data } = await axios.delete(`/api/playlists/${playlistId}`);
      if (data?.success) {
        toast.success('Playlist deleted successfully');
        setPlaylists(prev => prev.filter(p => p.id !== playlistId));
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Failed to delete playlist');
      } else {
        toast.error('Something went wrong');
      }
    }
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#B40000]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <ListMusic className="w-8 h-8 text-[#B40000]" />
          My Playlists
        </h1>
        <p className="text-gray-400">Create and manage your music playlists</p>
      </div>

      {/* Create Playlist Button */}
      <div className="mb-6">
        {!showCreateForm ? (
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-gradient-to-r from-[#800000] to-[#B40000] hover:from-[#600000] hover:to-[#900000]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create New Playlist
          </Button>
        ) : (
          <Card className="bg-[#1a1a1a] border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Create New Playlist</CardTitle>
              <CardDescription>Add a name for your playlist</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  placeholder="Playlist name"
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  className="bg-[#262626] border-gray-700 text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={createPlaylist}
                  disabled={creating}
                  className="bg-gradient-to-r from-[#800000] to-[#B40000] hover:from-[#600000] hover:to-[#900000]"
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewPlaylistName('');
                  }}
                  variant="outline"
                  className="border-gray-700 text-white hover:bg-[#262626]"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Playlists Grid */}
      {playlists.length === 0 ? (
        <div className="text-center py-20">
          <Music2 className="w-16 h-16 mx-auto mb-4 text-gray-600" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No playlists yet</h3>
          <p className="text-gray-500">Create your first playlist to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map(playlist => (
            <Card
              key={playlist.id}
              className="bg-[#1a1a1a] border-gray-700 hover:border-[#B40000] transition-all cursor-pointer group"
              onClick={() => router.push(`/playlist/${playlist.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg mb-1">{playlist.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {playlist._count.playlistSongs} song
                      {playlist._count.playlistSongs !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e => {
                      e.stopPropagation();
                      deletePlaylist(playlist.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-900/20 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Music2 className="w-4 h-4" />
                  Created {new Date(playlist.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
