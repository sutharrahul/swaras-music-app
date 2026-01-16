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
  const [allSongs, setAllSongs] = useState<SongeType[]>([]);

  // Get the current playlist (shuffled or original)
  // Use allSongs as fallback when songData is empty
  const availableSongs = allSongs.length > 0 ? allSongs : songData;
  const currentPlaylist = isShuffled ? shuffledSongs : availableSongs;

  const playSong = (songId: string) => {
    // Use allSongs if available, otherwise use songData
    const availableSongs = Array.isArray(allSongs) && allSongs.length > 0 ? allSongs : (Array.isArray(songData) ? songData : []);
    const currentList = Array.isArray(currentPlaylist) && currentPlaylist.length > 0 ? currentPlaylist : availableSongs;
    const playlist = Array.isArray(currentList) ? currentList : [];
    
    let selectSong = playlist.find((song: SongeType) => song.id === songId);
    
    // If not found in current playlist, try finding in available songs
    if (!selectSong && availableSongs.length > 0) {
      selectSong = availableSongs.find((song: SongeType) => song.id === songId);
    }
    
    // If still not found, fetch the song from API
    if (!selectSong) {
      fetch(`/api/get-songs`)
        .then(res => res.json())
        .then(data => {
          if (data?.success && data?.data?.songs) {
            const songs = data.data.songs;
            setAllSongs(songs); // Store all songs for navigation
            const song = songs.find((s: SongeType) => s.id === songId);
            if (song) {
              setCurrentSong(song);
            }
          }
        })
        .catch(error => console.error('Error fetching song:', error));
      return;
    }
    
    setCurrentSong(selectSong);
  };

  const toggleShuffle = () => {
    const songsToShuffle = allSongs.length > 0 ? allSongs : songData;
    
    if (!isShuffled) {
      if (songsToShuffle.length === 0) {
        // Fetch songs if not available
        fetch(`/api/get-songs`)
          .then(res => res.json())
          .then(data => {
            if (data?.success && data?.data?.songs) {
              const songs = data.data.songs;
              setAllSongs(songs);
              const shuffled = [...songs].sort(() => Math.random() - 0.5);
              setShuffledSongs(shuffled);
              setIsShuffled(true);
            }
          })
          .catch(error => console.error('Error fetching songs:', error));
        return;
      }
      // Shuffle the songs
      const shuffled = [...songsToShuffle].sort(() => Math.random() - 0.5);
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

    const playlist = Array.isArray(currentPlaylist) ? currentPlaylist : [];
    
    // If playlist is empty, fetch songs first
    if (playlist.length === 0) {
      fetch(`/api/get-songs`)
        .then(res => res.json())
        .then(data => {
          if (data?.success && data?.data?.songs) {
            const songs = data.data.songs;
            setAllSongs(songs);
            const currentIndex = songs.findIndex((song: SongeType) => song.id === currentSong.id);
            if (currentIndex !== -1 && currentIndex < songs.length - 1) {
              setCurrentSong(songs[currentIndex + 1]);
            } else if (repeatMode === 'all') {
              setCurrentSong(songs[0]);
            }
          }
        })
        .catch(error => console.error('Error fetching songs:', error));
      return;
    }

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

    const playlist = Array.isArray(currentPlaylist) ? currentPlaylist : [];
    
    // If playlist is empty, fetch songs first
    if (playlist.length === 0) {
      fetch(`/api/get-songs`)
        .then(res => res.json())
        .then(data => {
          if (data?.success && data?.data?.songs) {
            const songs = data.data.songs;
            setAllSongs(songs);
            const currentIndex = songs.findIndex((song: SongeType) => song.id === currentSong.id);
            if (currentIndex > 0) {
              setCurrentSong(songs[currentIndex - 1]);
            } else if (repeatMode === 'all') {
              setCurrentSong(songs[songs.length - 1]);
            }
          }
        })
        .catch(error => console.error('Error fetching songs:', error));
      return;
    }

    const currentIndex = playlist.findIndex((song: SongeType) => song.id === currentSong.id);

    if (currentIndex > 0) {
      setCurrentSong(playlist[currentIndex - 1]);
    } else if (repeatMode === 'all') {
      // Loop to the last song
      setCurrentSong(playlist[playlist.length - 1]);
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
