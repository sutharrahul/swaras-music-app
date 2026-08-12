'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { truncateByLetters } from '@/app/utils/truncateByLetters';
import { useSong } from '@/context/SongContextProvider';
import { formatTime } from '@/app/utils/formatTime';
import { CirclePlus, Trash2, Heart, MoreVertical } from 'lucide-react';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import toast from 'react-hot-toast';
import { usePlaylistMutations, useUserPlaylists } from '@/hook/query';
import { apiErrorMessage } from '@/hook/apiHooks';
import type { SongWithRelations } from '@/types/models';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/** The wire shape every list endpoint emits — see `src/lib/dto.ts`. */
type SongDataType = SongWithRelations;

type PlayListProps = {
  songData: SongDataType[] | undefined;
  dataType: 'allsong' | 'userPlaylist';
  /**
   * Which playlist is being shown, for `dataType === 'userPlaylist'`.
   *
   * "Remove from playlist" was already broken before this migration: it posted
   * `{ songId }` alone while the handler has always required a playlist id, so
   * every attempt was a 400. The component simply never knew which playlist it
   * was rendering. The parent passes it now.
   */
  playlistId?: string;
  /**
   * Number the rows 1, 2, 3… Off by default so the home screen and playlists are
   * unchanged; on for a single-artist listing, where the rank is meaningful
   * because every row belongs to the same performer.
   */
  showIndex?: boolean;
};

export default function PlayList({
  songData,
  dataType,
  playlistId,
  showIndex = false,
}: PlayListProps) {
  const { playSong, currentSong } = useSong();
  const { user } = useSupabaseUser();

  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [songPendingRemoval, setSongPendingRemoval] = useState<SongDataType | null>(null);

  // Only fetched once the picker is open, and shared with every other consumer
  // of `['playlists', 'user']` — creating a playlist below invalidates that key,
  // so the new one appears without a second hand-rolled reload.
  const { data: playlists = [], isLoading: loadingPlaylists } = useUserPlaylists(
    showPlaylistModal && !!user
  );
  const { createPlaylistMutation, addSongToPlaylistMutation, removeSongFromPlaylistMutation } =
    usePlaylistMutations();

  /**
   * This used to finish with `window.location.reload()`. That reloads the
   * document, so the `<audio>` element goes with it and the music stops
   * mid-track for someone who only removed a song from a list they were not
   * listening to. The mutation invalidates the affected query keys instead,
   * which re-renders the list and leaves playback alone.
   */
  const pendingSongId = removeSongFromPlaylistMutation.isPending
    ? removeSongFromPlaylistMutation.variables.songId
    : null;

  const addSongToPlaylist = (songId: string) => {
    if (!user) {
      toast.error('Please log in to add songs to playlists');
      return;
    }

    setSelectedSongId(songId);
    setShowPlaylistModal(true);
  };

  const handleAddToPlaylist = (targetPlaylistId: string) => {
    if (!selectedSongId) return;

    addSongToPlaylistMutation.mutate(
      { playlistId: targetPlaylistId, songId: selectedSongId },
      {
        onSuccess: () => {
          toast.success('Song added to playlist');
          setShowPlaylistModal(false);
        },
        onError: error => toast.error(apiErrorMessage(error, 'Failed to add song')),
      }
    );
  };

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) {
      toast.error('Please enter a playlist name');
      return;
    }

    createPlaylistMutation.mutate(
      { name: newPlaylistName.trim() },
      {
        onSuccess: () => {
          toast.success('Playlist created successfully');
          setNewPlaylistName('');
          setShowCreateForm(false);
        },
        onError: error => toast.error(apiErrorMessage(error, 'Failed to create playlist')),
      }
    );
  };

  const removeSongFromPlaylist = (songId: string) => {
    if (!playlistId) {
      toast.error('Cannot tell which playlist this is');
      return;
    }

    removeSongFromPlaylistMutation.mutate(
      { playlistId, songId },
      {
        onSuccess: () => toast.success('Song removed'),
        onError: error => toast.error(apiErrorMessage(error, 'Failed to remove song')),
      }
    );
  };

  const closePlaylistModal = () => {
    setShowPlaylistModal(false);
    setShowCreateForm(false);
    setNewPlaylistName('');
  };

  return (
    <>
      <ul className="space-y-1 px-2 md:px-8">
        {songData?.map((song, index) => {
          const isCurrent = song.id === currentSong?.id;

          return (
            <li
              key={song.id}
              className={`flex items-center justify-between px-2 py-1.5 rounded transition-colors ${
                isCurrent ? 'bg-brand/30 backdrop-blur-sm' : 'hover:bg-accent/40'
              }`}
            >
              {/* Song Click Area */}
              <button
                type="button"
                onClick={() => playSong(song.id)}
                aria-current={isCurrent ? 'true' : undefined}
                className="flex items-center gap-3 md:gap-4 flex-1 min-w-0 cursor-pointer text-left rounded"
              >
                {showIndex && (
                  // `aria-hidden`: the position is a visual affordance, and a
                  // screen reader already gets it from the list semantics — the
                  // row would otherwise be announced as "3 Hips Dont Lie".
                  // Tabular figures so the column does not jitter at 10+.
                  <span
                    aria-hidden="true"
                    className="w-5 flex-shrink-0 text-right text-sm tabular-nums text-muted-foreground"
                  >
                    {index + 1}
                  </span>
                )}
                <Image
                  src={song.coverUrl || '/assets/songicon.png'}
                  alt=""
                  width={40}
                  height={40}
                  className="w-9 h-9 md:w-10 md:h-10 object-cover rounded flex-shrink-0"
                />

                <div className="flex flex-col md:grid md:grid-cols-3 md:gap-4 md:flex-1 min-w-0">
                  <span className="text-foreground text-sm md:font-semibold truncate">
                    {truncateByLetters(song.title, 25)}
                  </span>
                  <span className="text-muted-foreground text-xs md:text-sm truncate">
                    {truncateByLetters(song.artist.join(', '), 35)}
                  </span>
                  <span className="text-muted-foreground text-xs md:text-sm truncate hidden md:block">
                    {song.album || 'Unknown'}
                  </span>
                </div>

                <span className="text-muted-foreground text-sm mx-3 hidden md:inline flex-shrink-0">
                  {formatTime(Math.floor(song.duration))}
                </span>
              </button>

              {/* Like Count and Action Menu */}
              <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
                {/* Like Count */}
                <div className="flex items-center gap-1">
                  <Heart
                    aria-hidden="true"
                    className="h-3 w-3 md:h-4 md:w-4 text-brand fill-brand"
                  />
                  <span className="text-muted-foreground text-xs md:text-sm">
                    {song._count?.likes || 0}
                  </span>
                  <span className="sr-only">likes</span>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${song.title}`}
                    disabled={pendingSongId === song.id}
                    className="p-1 rounded text-foreground/80 hover:text-foreground disabled:opacity-50 disabled:cursor-wait"
                  >
                    <MoreVertical aria-hidden="true" className="h-5 w-5 md:h-6 md:w-6" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {dataType === 'allsong' ? (
                      <DropdownMenuItem onSelect={() => addSongToPlaylist(song.id)}>
                        <CirclePlus aria-hidden="true" />
                        Add to playlist
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setSongPendingRemoval(song)}
                      >
                        <Trash2 aria-hidden="true" />
                        Remove from playlist
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Playlist Selection Modal */}
      <Dialog
        open={showPlaylistModal}
        onOpenChange={open => (open ? setShowPlaylistModal(true) : closePlaylistModal())}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">Add to Playlist</DialogTitle>
          </DialogHeader>

          {loadingPlaylists ? (
            <p className="text-muted-foreground text-center py-4">Loading playlists...</p>
          ) : (
            <>
              {/* Create New Playlist Form */}
              {showCreateForm ? (
                <div className="p-4 bg-secondary rounded-lg">
                  <h4 className="text-foreground font-medium mb-3">Create New Playlist</h4>
                  <Input
                    type="text"
                    value={newPlaylistName}
                    onChange={e => setNewPlaylistName(e.target.value)}
                    placeholder="Playlist name"
                    aria-label="Playlist name"
                    className="w-full px-3 py-2 bg-card text-foreground rounded-lg border-border mb-3"
                    disabled={createPlaylistMutation.isPending}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={handleCreatePlaylist}
                      disabled={createPlaylistMutation.isPending}
                      className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {createPlaylistMutation.isPending ? 'Creating...' : 'Create'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewPlaylistName('');
                      }}
                      disabled={createPlaylistMutation.isPending}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setShowCreateForm(true)}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                >
                  + Create New Playlist
                </Button>
              )}

              {/* Existing Playlists */}
              {playlists.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No playlists yet. Create one above!
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {playlists.map(playlist => (
                    <button
                      key={playlist.id}
                      type="button"
                      onClick={() => handleAddToPlaylist(playlist.id)}
                      className="w-full text-left p-3 hover:bg-secondary rounded-lg transition-colors"
                    >
                      <p className="text-foreground font-medium">{playlist.name}</p>
                      <p className="text-muted-foreground text-sm">
                        {playlist._count.playlistSongs} songs
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button variant="secondary" onClick={closePlaylistModal} className="w-full">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove from playlist confirmation */}
      <AlertDialog
        open={songPendingRemoval !== null}
        onOpenChange={open => !open && setSongPendingRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove “{songPendingRemoval?.title}” from this playlist?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The song stays in the library — it is only removed from this playlist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const song = songPendingRemoval;
                setSongPendingRemoval(null);
                if (song) removeSongFromPlaylist(song.id);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
