'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Music2, Trash2, ListMusic, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import EmptyState from '@/components/states/EmptyState';

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
  const { user, isLoaded } = useSupabaseUser();
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [playlistPendingDelete, setPlaylistPendingDelete] = useState<Playlist | null>(null);

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
      <div
        role="status"
        aria-label="Loading playlists"
        className="flex items-center justify-center h-full"
      >
        <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <ListMusic aria-hidden="true" className="w-8 h-8 text-brand" />
          My Playlists
        </h1>
        <p className="text-muted-foreground">Create and manage your music playlists</p>
      </div>

      {/* Create Playlist Button */}
      <div className="mb-6">
        {!showCreateForm ? (
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-brand-gradient hover:bg-brand-gradient-hover"
          >
            <Plus aria-hidden="true" className="w-5 h-5 mr-2" />
            Create New Playlist
          </Button>
        ) : (
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-white">Create New Playlist</CardTitle>
              <CardDescription>Add a name for your playlist</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Input
                  placeholder="Playlist name"
                  aria-label="Playlist name"
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  className="bg-secondary dark:bg-secondary border-border text-white"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={createPlaylist}
                  disabled={creating}
                  className="bg-brand-gradient hover:bg-brand-gradient-hover"
                >
                  {creating ? (
                    <>
                      <Loader2 aria-hidden="true" className="w-4 h-4 mr-2 animate-spin" />
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
                  className="border-border text-white hover:bg-secondary"
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
        <EmptyState
          icon={Music2}
          title="No playlists yet"
          description="Create your first playlist to get started"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map(playlist => (
            <Card
              key={playlist.id}
              className="relative border-border hover:border-brand transition-all group focus-within:border-brand"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg mb-1">
                      {/* Stretched link: the whole card is clickable, but only
                          this anchor is in the tab order. */}
                      <Link
                        href={`/playlist/${playlist.id}`}
                        className="outline-none after:absolute after:inset-0 after:rounded-xl after:content-['']"
                      >
                        {playlist.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {playlist._count.playlistSongs} song
                      {playlist._count.playlistSongs !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete playlist ${playlist.name}`}
                    onClick={() => setPlaylistPendingDelete(playlist)}
                    className="relative z-10 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-red-900/20 hover:text-red-500"
                  >
                    <Trash2 aria-hidden="true" className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
                  <Music2 aria-hidden="true" className="w-4 h-4" />
                  Created {new Date(playlist.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog
        open={playlistPendingDelete !== null}
        onOpenChange={open => !open && setPlaylistPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{playlistPendingDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The playlist is removed for good. The songs in it stay in the library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const playlist = playlistPendingDelete;
                setPlaylistPendingDelete(null);
                if (playlist) deletePlaylist(playlist.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
