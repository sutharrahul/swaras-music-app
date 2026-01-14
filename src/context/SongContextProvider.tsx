'use client';
import React, { createContext, ReactNode, useContext, useState } from 'react';
import { SongWithRelations } from '@/types/prisma';
import { useSongs } from '@/hook/query';

interface SongeType extends SongWithRelations {
  _id?: string; // For backward compatibility with MongoDB _id
}

type RepeatMode = 'off' | 'all' | 'one';

type MusicPlayerContextType = {
  // UI State (managed by context)
  currentSong: SongeType | null;
  playSong: (songId: string) => void;
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

export const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  // ============== TanStack Query (Server State) ==============
  const { data: songsResponse, isLoading, error } = useSongs();
  const songData = songsResponse?.data || [];

  // ============== UI State (Context) ==============
  const [currentSong, setCurrentSong] = useState<SongeType | null>(null);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffledSongs, setShuffledSongs] = useState<SongeType[]>([]);

  // Get the current playlist (shuffled or original)
  const currentPlaylist = isShuffled ? shuffledSongs : songData;

  const playSong = (songId: string) => {
    const selectSong = currentPlaylist.find((song: SongeType) => song.id === songId);
    if (selectSong) {
      setCurrentSong(selectSong);
    }
  };

  const toggleShuffle = () => {
    if (!isShuffled) {
      // Shuffle the songs
      const shuffled = [...songData].sort(() => Math.random() - 0.5);
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

    const currentIndex = currentPlaylist.findIndex((song: SongeType) => song.id === currentSong.id);

    if (repeatMode === 'one') {
      // Replay the same song - trigger re-render by setting to null then back
      const currentSongRef = currentSong;
      setCurrentSong(null);
      setTimeout(() => setCurrentSong(currentSongRef), 0);
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex < currentPlaylist.length) {
      setCurrentSong(currentPlaylist[nextIndex]);
    } else if (repeatMode === 'all') {
      // Loop back to the first song
      setCurrentSong(currentPlaylist[0]);
    }
  };

  const playPrevious = () => {
    if (!currentSong) return;

    const currentIndex = currentPlaylist.findIndex((song: SongeType) => song.id === currentSong.id);

    if (currentIndex > 0) {
      setCurrentSong(currentPlaylist[currentIndex - 1]);
    } else if (repeatMode === 'all') {
      // Loop to the last song
      setCurrentSong(currentPlaylist[currentPlaylist.length - 1]);
    }
  };

  return (
    <MusicPlayerContext.Provider
      value={{
        // UI State
        currentSong,
        playSong,
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
    </MusicPlayerContext.Provider>
  );
}

// Hook to use the music player context
export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (!context) throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  return context;
}

// Backward compatibility - keep old hook name
export function useSong() {
  return useMusicPlayer();
}

// Re-export provider with old name for backward compatibility
export const SongProvider = MusicPlayerProvider;
export const SongContext = MusicPlayerContext;
