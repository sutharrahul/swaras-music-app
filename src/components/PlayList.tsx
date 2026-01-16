'use client';

import React, { MouseEvent, useState } from 'react';
import { truncateByLetters } from '@/app/utils/truncateByLetters';
import { useSong } from '@/context/SongContextProvider';
import { formatTime } from '@/app/utils/formatTime';
import { CirclePlus, Trash2, Heart } from 'lucide-react';
import axios from 'axios';
import { useUser } from '@clerk/nextjs';
import toast from 'react-hot-toast';
import { useUserQueries } from '@/hook/query';

type SongDataType = {
  id: string;
  audioUrl: string;
  duration: number;
  title: string;
  artist: string[];
  composers: string[];
  album?: string;
  coverUrl?: string;
  _count?: {
    likes: number;
  };
};

type PlayListProps = {
  songData: SongDataType[] | undefined;
  dataType: 'allsong' | 'userPlaylist';
};

export default function PlayList({ songData, dataType }: PlayListProps) {
  const { playSong, currentSong } = useSong();
  const { user } = useUser();
  const { useCheckAdmin } = useUserQueries();
  const { data: adminData } = useCheckAdmin();
  const isAdmin = adminData?.data?.isAdmin || false;

  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [deletingSongId, setDeletingSongId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  const loadPlaylists = async () => {
    try {
      setLoadingPlaylists(true);
      const { data } = await axios.get('/api/playlists');
      if (data?.success) {
        setPlaylists(data.data);
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
    } finally {
      setLoadingPlaylists(false);
    }
  };

  const addSongToPlaylist = async (e: MouseEvent<SVGSVGElement>, songId: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (!user) {
      toast.error('Please log in to add songs to playlists');
      return;
    }

    setSelectedSongId(songId);
    setShowPlaylistModal(true);
    loadPlaylists();
  };

  const handleAddToPlaylist = async (playlistId: string) => {
    if (!selectedSongId) return;

    try {
      const { data } = await axios.post('/api/post-playlist', {
        playlistId,
        songId: selectedSongId,
      });

      if (data.success) {
        toast.success('Song added to playlist');
        setShowPlaylistModal(false);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.message || 'Failed to add song';
        toast.error(errorMsg);
      } else {
        toast.error('Something went wrong');
      }
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      toast.error('Please enter a playlist name');
      return;
    }

    try {
      setCreatingPlaylist(true);
      const { data } = await axios.post('/api/playlists', {
        name: newPlaylistName.trim(),
      });

      if (data.success) {
        toast.success('Playlist created successfully');
        setNewPlaylistName('');
        setShowCreateForm(false);
        // Reload playlists
        loadPlaylists();
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.message || 'Failed to create playlist';
        toast.error(errorMsg);
      } else {
        toast.error('Something went wrong');
      }
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const removeSongFromPlaylist = async (e: MouseEvent<SVGSVGElement>, songId: string) => {
    e.stopPropagation();
    e.preventDefault();

    try {
      const { data } = await axios.delete('/api/remove-playlist-song', {
        data: { songId },
      });

      if (data.success) {
        toast.success('Song removed');
        window.location.reload(); // Reload to update the list
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.message || 'Failed to remove song';
        toast.error(errorMsg);
      } else {
        toast.error('Something went wrong');
      }
    }
  };

  const deleteSongPermanently = async (e: MouseEvent<SVGSVGElement>, songId: string) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isAdmin) {
      toast.error('Admin privileges required');
      return;
    }

    // Confirm deletion
    if (
      !window.confirm(
        'Are you sure you want to permanently delete this song? This action cannot be undone.'
      )
    ) {
      return;
    }

    try {
      setDeletingSongId(songId);
      const userId = adminData?.data?.userId;

      const { data } = await axios.delete('/api/admin/delete-song', {
        data: { songId, userId },
      });

      if (data.success) {
        toast.success('Song deleted successfully');
        window.location.reload(); // Reload to update the list
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.message || 'Failed to delete song';
        toast.error(errorMsg);
      } else {
        toast.error('Something went wrong');
      }
    } finally {
      setDeletingSongId(null);
    }
  };

  return (
    <>
      <ul className="space-y-1 px-2 md:px-8">
        {songData?.map(song => (
          <li
            key={song.id}
            className={`flex items-center justify-between my-7 px-2 py-3 cursor-pointer rounded transition-colors ${
              song.id === currentSong?.id
                ? 'bg-[#B40000]/30 backdrop-blur-sm'
                : 'hover:bg-zinc-800/40'
            }`}
          >
            {/* Song Click Area */}
            <div onClick={() => playSong(song.id)} className="flex items-center gap-5 flex-1">
              {song.coverUrl ? (
                <img
                  src={song.coverUrl}
                  alt={song.title}
                  className="w-9 h-9 md:w-12 md:h-12 object-cover rounded"
                />
              ) : (
                <img
                  src="/assets/songicon.png"
                  alt={song.title}
                  className="w-9 h-9 md:w-12 md:h-12 object-cover rounded"
                />
              )}

              <div className="flex flex-col md:grid md:grid-cols-3 md:gap-5 md:flex-1">
                <p className="text-white text-sm md:text-base md:font-medium truncate">
                  {truncateByLetters(song.title, 25)}
                </p>
                <p className="text-gray-400 text-xs md:text-sm truncate">
                  {truncateByLetters(song.artist.join(', '), 35)}
                </p>
                <p className="text-gray-400 text-xs md:text-sm truncate">
                  {song.album || 'Unknown'}
                </p>
              </div>

              {/* Like Count */}
              <div className="flex items-center gap-1 mx-2 md:mx-4">
                <Heart className="h-3 w-3 md:h-4 md:w-4 text-[#B40000] fill-[#B40000]" />
                <span className="text-gray-400 text-xs md:text-sm">{song._count?.likes || 0}</span>
              </div>

              <span className="text-gray-400 text-sm mx-4 hidden md:inline">
                {formatTime(Math.floor(song.duration))}
              </span>
            </div>

            {/* Action Icon */}
            <div className="flex items-center gap-2">
              {dataType === 'allsong' ? (
                <>
                  <div className="relative group">
                    <div className="absolute bottom-full bg-[#141414] mb-2 left-1/2 -translate-x-1/2 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                      Add to playlist
                    </div>
                    <CirclePlus
                      onClick={e => addSongToPlaylist(e, song.id)}
                      className="h-5 w-5 md:h-7 md:w-7 text-gray-300 hover:text-white cursor-pointer"
                    />
                  </div>

                  {/* Admin Delete Button */}
                  {isAdmin && (
                    <div className="relative group">
                      <div className="absolute bottom-full bg-[#141414] mb-2 left-1/2 -translate-x-1/2 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        Delete song (Admin)
                      </div>
                      <Trash2
                        onClick={e => deleteSongPermanently(e, song.id)}
                        className={`h-5 w-5 md:h-6 md:w-6 text-red-500 hover:text-red-600 cursor-pointer ${
                          deletingSongId === song.id ? 'opacity-50 cursor-wait' : ''
                        }`}
                      />
                    </div>
                  )}
                </>
              ) : (
                <Trash2
                  onClick={e => removeSongFromPlaylist(e, song.id)}
                  className="h-4 w-4 md:h-7 md:w-7 text-[#B40000] hover:text-red-600 cursor-pointer"
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Playlist Selection Modal */}
      {showPlaylistModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          onClick={() => {
            setShowPlaylistModal(false);
            setShowCreateForm(false);
            setNewPlaylistName('');
          }}
        >
          <div
            className="bg-[#1a1a1a] rounded-lg p-6 max-w-md w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-white mb-4">Add to Playlist</h3>

            {loadingPlaylists ? (
              <p className="text-gray-400 text-center py-4">Loading playlists...</p>
            ) : (
              <>
                {/* Create New Playlist Form */}
                {showCreateForm ? (
                  <div className="mb-4 p-4 bg-[#262626] rounded-lg">
                    <h4 className="text-white font-medium mb-3">Create New Playlist</h4>
                    <input
                      type="text"
                      value={newPlaylistName}
                      onChange={e => setNewPlaylistName(e.target.value)}
                      placeholder="Playlist name"
                      className="w-full px-3 py-2 bg-[#1a1a1a] text-white rounded-lg border border-gray-700 focus:border-[#B40000] focus:outline-none mb-3"
                      disabled={creatingPlaylist}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleCreatePlaylist}
                        disabled={creatingPlaylist}
                        className="flex-1 py-2 bg-[#B40000] hover:bg-[#900000] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creatingPlaylist ? 'Creating...' : 'Create'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCreateForm(false);
                          setNewPlaylistName('');
                        }}
                        disabled={creatingPlaylist}
                        className="flex-1 py-2 bg-[#333] hover:bg-[#444] text-white rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full mb-4 py-3 bg-[#B40000] hover:bg-[#900000] text-white rounded-lg transition-colors font-medium"
                  >
                    + Create New Playlist
                  </button>
                )}

                {/* Existing Playlists */}
                {playlists.length === 0 ? (
                  <p className="text-gray-400 text-center py-4">
                    No playlists yet. Create one above!
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {playlists.map(playlist => (
                      <button
                        key={playlist.id}
                        onClick={() => handleAddToPlaylist(playlist.id)}
                        className="w-full text-left p-3 hover:bg-[#262626] rounded-lg transition-colors"
                      >
                        <p className="text-white font-medium">{playlist.name}</p>
                        <p className="text-gray-400 text-sm">
                          {playlist._count.playlistSongs} songs
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            <button
              onClick={() => {
                setShowPlaylistModal(false);
                setShowCreateForm(false);
                setNewPlaylistName('');
              }}
              className="mt-4 w-full py-2 bg-[#262626] hover:bg-[#333] text-white rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
