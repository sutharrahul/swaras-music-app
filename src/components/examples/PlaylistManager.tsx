/**
 * Example Component: Playlist Manager
 *
 * This component demonstrates how to use the TanStack Query hooks
 * for managing playlists in the Swaras Music App.
 */

'use client';

import { useUserPlaylists, usePlaylist, usePlaylistMutations } from '@/hook/query';
import { useUser } from '@clerk/nextjs';
import { useState } from 'react';

export default function PlaylistManager() {
  const { user } = useUser();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Query: Fetch user's playlists
  const { data: playlistsResponse, isLoading: loadingPlaylists } = useUserPlaylists(
    user?.id || '',
    !!user
  );

  // Query: Fetch selected playlist details
  const { data: playlistDetails, isLoading: loadingDetails } = usePlaylist(
    selectedPlaylistId || '',
    !!selectedPlaylistId
  );

  // Mutations
  const {
    createPlaylistMutation,
    deletePlaylistMutation,
    removeSongFromPlaylistMutation,
  } = usePlaylistMutations();

  // Create new playlist
  const handleCreatePlaylist = (songId: string) => {
    if (!user || !newPlaylistName) return;

    createPlaylistMutation.mutate(
      {
        userId: user.id,
        playlistName: newPlaylistName,
        songId,
      },
      {
        onSuccess: () => {
          setNewPlaylistName('');
          alert('Playlist created!');
        },
        onError: (error: any) => {
          alert(`Failed: ${error.message}`);
        },
      }
    );
  };

  // Delete playlist
  const handleDeletePlaylist = (playlistId: string) => {
    if (!user) return;

    if (confirm('Are you sure you want to delete this playlist?')) {
      deletePlaylistMutation.mutate(
        { playlistId, userId: user.id },
        {
          onSuccess: () => {
            setSelectedPlaylistId(null);
            alert('Playlist deleted!');
          },
        }
      );
    }
  };

  // Remove song from playlist
  const handleRemoveSong = (playlistId: string, songId: string) => {
    removeSongFromPlaylistMutation.mutate(
      { playlistId, songId },
      {
        onSuccess: () => {
          alert('Song removed from playlist!');
        },
      }
    );
  };

  if (!user) {
    return <div className="p-4">Please log in to manage playlists</div>;
  }

  if (loadingPlaylists) {
    return <div className="p-4">Loading playlists...</div>;
  }

  const playlists = playlistsResponse?.data || [];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Playlist Manager</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Playlists List */}
        <div>
          <h2 className="text-xl font-semibold mb-4">My Playlists ({playlists.length})</h2>

          {/* Create Playlist Form */}
          <div className="mb-4 p-4 bg-gray-100 rounded-lg">
            <input
              type="text"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              placeholder="New playlist name"
              className="w-full px-3 py-2 border rounded mb-2"
            />
            <button
              onClick={() => handleCreatePlaylist('SAMPLE_SONG_ID')}
              disabled={!newPlaylistName || createPlaylistMutation.isPending}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
            >
              {createPlaylistMutation.isPending ? 'Creating...' : 'Create Playlist'}
            </button>
          </div>

          {/* Playlists */}
          <div className="space-y-2">
            {playlists.map((playlist: any) => (
              <div
                key={playlist.id}
                className={`p-4 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                  selectedPlaylistId === playlist.id ? 'bg-blue-50 border-blue-500' : ''
                }`}
                onClick={() => setSelectedPlaylistId(playlist.id)}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold">{playlist.name}</h3>
                    <p className="text-sm text-gray-600">
                      {playlist.playlistSongs?.length || 0} songs
                    </p>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleDeletePlaylist(playlist.id);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Playlist Details */}
        <div>
          {selectedPlaylistId ? (
            <>
              <h2 className="text-xl font-semibold mb-4">Playlist Details</h2>
              {loadingDetails ? (
                <div>Loading details...</div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{playlistDetails?.data?.name}</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Created by: {playlistDetails?.data?.user?.firstName}{' '}
                    {playlistDetails?.data?.user?.lastName}
                  </p>

                  {/* Songs in Playlist */}
                  <div className="space-y-2">
                    {playlistDetails?.data?.playlistSongs?.map((ps: any) => (
                      <div
                        key={ps.id}
                        className="p-3 border rounded flex justify-between items-center"
                      >
                        <div>
                          <p className="font-medium">{ps.song.title}</p>
                          <p className="text-xs text-gray-500">Position: {ps.position}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveSong(selectedPlaylistId, ps.song.id)}
                          disabled={removeSongFromPlaylistMutation.isPending}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-gray-500 text-center mt-10">Select a playlist to view details</div>
          )}
        </div>
      </div>
    </div>
  );
}
