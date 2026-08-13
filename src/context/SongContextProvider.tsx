'use client';
import React, { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import { SongWithRelations } from '@/types/models';
import { useSongsInfinite } from '@/hook/query';

interface SongeType extends SongWithRelations {
  _id?: string; // For backward compatibility with MongoDB _id
}

type RepeatMode = 'off' | 'all' | 'one';

type MusicPlayerContextType = {
  // UI State (managed by context)
  currentSong: SongeType | null;
  playSong: (songId: string) => void;
  /**
   * Play an explicit list and make it the queue, so next/previous walk THAT
   * list rather than the whole catalogue. Used by "play all" on a filtered
   * screen (an artist, an album) where the catalogue order is not what the
   * listener is looking at.
   */
  playQueue: (songs: SongeType[], startIndex?: number) => void;
  isShuffled: boolean;
  toggleShuffle: () => void;
  repeatMode: RepeatMode;
  toggleRepeat: () => void;
  playNext: () => void;
  playPrevious: () => void;
  // Server State (from TanStack Query)
  songData: SongeType[];
  loading: boolean;
  error: string | undefined;
};

const SongContext = createContext<MusicPlayerContextType | undefined>(undefined);

export function SongProvider({ children }: { children: ReactNode }) {
  // ============== TanStack Query (Server State) ==============
  // The same cache entry the home screen paginates, so the queue grows as the
  // reader scrolls instead of being stuck on page one.
  //
  // This used to read `songsResponse?.data`, which is the `{ songs, pagination }`
  // envelope — an object, not an array. Every consumer below therefore failed its
  // `Array.isArray` guard and fell through to a hand-rolled `fetch('/api/get-songs')`
  // that re-fetched exactly what the hook had already put in the cache. Four of
  // those fallbacks existed; with the shape corrected they are unreachable, so
  // they are gone.
  const { data, isLoading, error } = useSongsInfinite();
  const songData = useMemo(() => data?.pages.flatMap(page => page.songs) ?? [], [data]);

  // ============== UI State (Context) ==============
  const [currentSong, setCurrentSong] = useState<SongeType | null>(null);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffledSongs, setShuffledSongs] = useState<SongeType[]>([]);

  /**
   * An explicit queue set by `playQueue`, or null to mean "the catalogue".
   * Null rather than defaulting to a copy of `songData`, so the queue keeps
   * GROWING as infinite scroll appends pages — which is the behaviour the home
   * screen has always relied on.
   */
  const [queue, setQueue] = useState<SongeType[] | null>(null);
  const activeQueue = queue ?? songData;

  // Get the current playlist (shuffled or original)
  const currentPlaylist = isShuffled ? shuffledSongs : activeQueue;

  const playSong = (songId: string) => {
    // The active queue first, the catalogue second. The fallback matters: a row
    // on a filtered screen can be a song that is not in the loaded catalogue
    // pages at all, and looking only at `songData` would silently do nothing.
    const selectSong =
      activeQueue.find((song: SongeType) => song.id === songId) ??
      songData.find((song: SongeType) => song.id === songId);
    if (selectSong) {
      setCurrentSong(selectSong);
    }
  };

  const playQueue = (songs: SongeType[], startIndex = 0) => {
    if (songs.length === 0) return;
    const index = Math.min(Math.max(startIndex, 0), songs.length - 1);
    setQueue(songs);
    // A fresh queue starts in its own order. Inheriting a shuffle from whatever
    // the listener did on a previous screen would make "play" mean something
    // different depending on history.
    setIsShuffled(false);
    setCurrentSong(songs[index]);
  };

  const toggleShuffle = () => {
    if (!isShuffled) {
      // Shuffles whatever is actually playing — the artist's songs when one is
      // queued, the catalogue otherwise.
      const shuffled = [...activeQueue].sort(() => Math.random() - 0.5);
      setShuffledSongs(shuffled);
      setIsShuffled(true);
    } else {
      // Restore original order
      setIsShuffled(false);
    }
  };

  const toggleRepeat = () => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  };

  const playNext = () => {
    if (!currentSong) return;

    const playlist = currentPlaylist;
    const currentIndex = playlist.findIndex((song: SongeType) => song.id === currentSong.id);

    if (repeatMode === 'one') {
      // Replay the same song - trigger re-render by setting to null then back
      const currentSongRef = currentSong;
      setCurrentSong(null);
      setTimeout(() => setCurrentSong(currentSongRef), 0);
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex < playlist.length) {
      setCurrentSong(playlist[nextIndex]);
    } else if (repeatMode === 'all') {
      // Loop back to the first song
      setCurrentSong(playlist[0]);
    }
  };

  const playPrevious = () => {
    if (!currentSong) return;

    const playlist = currentPlaylist;
    const currentIndex = playlist.findIndex((song: SongeType) => song.id === currentSong.id);

    if (currentIndex > 0) {
      setCurrentSong(playlist[currentIndex - 1]);
    } else if (repeatMode === 'all') {
      // Loop to the last song
      setCurrentSong(playlist[playlist.length - 1]);
    }
  };

  return (
    <SongContext.Provider
      value={{
        // UI State
        currentSong,
        playSong,
        playQueue,
        isShuffled,
        toggleShuffle,
        repeatMode,
        toggleRepeat,
        playNext,
        playPrevious,
        // Server State (from TanStack Query)
        songData,
        loading: isLoading,
        error: error?.message,
      }}
    >
      {children}
    </SongContext.Provider>
  );
}

/** Read the player. Throws rather than returning undefined, so a component
 *  mounted outside the provider fails loudly instead of silently no-op-ing. */
export function useSong() {
  const context = useContext(SongContext);
  if (!context) throw new Error('useSong must be used within a SongProvider');
  return context;
}
