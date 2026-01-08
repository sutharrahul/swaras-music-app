'use client';
import axios from 'axios';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Song } from '@/types/prisma';
import { useSession } from 'next-auth/react';

interface SongeType extends Song {
  // Prisma uses 'id' instead of '_id'
}

type RepeatMode = 'off' | 'all' | 'one';

type SongDataType = {
  songData: SongeType[];
  loading: boolean;
  erroMessage: string | undefined;
  currentSong: SongeType | null;
  playSong: (songId: string) => void;
  userPlaylist: SongeType[];
  isShuffled: boolean;
  toggleShuffle: () => void;
  repeatMode: RepeatMode;
  toggleRepeat: () => void;
  playNext: () => void;
  playPrevious: () => void;
};

export const SongContext = createContext<SongDataType | undefined>(undefined);

export function SongProvider({ children }: { children: ReactNode }) {
  const [songData, setSongData] = useState<SongeType[]>([]);
  const [userPlaylist, setUserPlaylist] = useState<SongeType[]>([]);
  const [erroMessage, setErrorMessage] = useState<string | undefined>();
  const [loading, setLoading] = useState<boolean>(false);
  const [currentSong, setCurrentSong] = useState<SongeType | null>(null);
  const [isShuffled, setIsShuffled] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [originalOrder, setOriginalOrder] = useState<SongeType[]>([]);
  const { data: session, status } = useSession();

  // get-all song
  useEffect(() => {
    async function getAllSongs() {
      setLoading(true);
      try {
        const { data } = await axios.get('/api/get-songs');

        if (data.data.length === 0 || !data.data) {
          setErrorMessage(data.message);
          setSongData([]);
        } else {
          setSongData(data.data);
          setOriginalOrder(data.data);
          setErrorMessage(undefined);
        }
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch songs', err);
        setLoading(false);
        return [];
      }
    }

    getAllSongs();
  }, []);

  // get-playlist
  useEffect(() => {
    async function GetPlaylist() {
      setLoading(true);
      try {
        const { data } = await axios.get(`/api/get-playlist?userId=${session?.user?._id}`);
        const playListSongs = data?.data?.playListSong;
        setUserPlaylist(playListSongs);
      } catch (error) {
        console.error('Failed to fetch playlist', error);
      } finally {
        setLoading(false);
      }
    }
    if (status === 'authenticated' && session?.user?._id) {
      GetPlaylist();
    }
  }, [session?.user?._id, status, setUserPlaylist, setLoading]);

  const playSong = (songId: string) => {
    const selectSong = songData.find(song => song.id === songId);
    if (selectSong) {
      setCurrentSong(selectSong);
    }
  };

  const toggleShuffle = () => {
    if (!isShuffled) {
      // Shuffle the songs
      const shuffled = [...songData].sort(() => Math.random() - 0.5);
      setSongData(shuffled);
      setIsShuffled(true);
    } else {
      // Restore original order
      setSongData(originalOrder);
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

    const currentIndex = songData.findIndex(song => song.id === currentSong.id);

    if (repeatMode === 'one') {
      // Replay the same song - trigger re-render by setting to null then back
      const currentSongRef = currentSong;
      setCurrentSong(null);
      setTimeout(() => setCurrentSong(currentSongRef), 0);
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex < songData.length) {
      setCurrentSong(songData[nextIndex]);
    } else if (repeatMode === 'all') {
      // Loop back to the first song
      setCurrentSong(songData[0]);
    }
  };

  const playPrevious = () => {
    if (!currentSong) return;

    const currentIndex = songData.findIndex(song => song.id === currentSong.id);

    if (currentIndex > 0) {
      setCurrentSong(songData[currentIndex - 1]);
    } else if (repeatMode === 'all') {
      // Loop to the last song
      setCurrentSong(songData[songData.length - 1]);
    }
  };

  return (
    <SongContext.Provider
      value={{
        loading,
        songData,
        erroMessage,
        currentSong,
        playSong,
        userPlaylist,
        isShuffled,
        toggleShuffle,
        repeatMode,
        toggleRepeat,
        playNext,
        playPrevious,
      }}
    >
      {children}
    </SongContext.Provider>
  );
}

export function useSong() {
  const context = useContext(SongContext);
  if (!context) throw new Error('useSong must be used within a SongProvider');

  return context;
}
