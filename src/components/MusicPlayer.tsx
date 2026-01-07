'use client';
import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { useSong } from '@/context/SongContextProvider';
import NextButton from '@/assets/Icons/NextButton';
import {
  Pause,
  Play,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
} from 'lucide-react';
import PreviousButton from '@/assets/Icons/PreviousButton';
import { formatTime } from '@/app/utils/formatTime';
import { truncateByLetters } from '@/app/utils/truncateByLetters';

export default function MusicPlayer() {
  const {
    currentSong,
    songData,
    isShuffled,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    playNext,
    playPrevious,
  } = useSong();
  const [currectTime, setCurrectTime] = useState<number>(0);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // play paush button
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }

    setIsPlaying(!isPlaying);
  };

  // handel progressbar
  const handleProgressBar = (e: ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);

    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }

    setCurrectTime(time);
  };

  // Volume contol
  const handleVolumeBar = (e: ChangeEvent<HTMLInputElement>) => {
    const volume = Number(e.target.value);

    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    localStorage.setItem('volume', volume.toString());
    setVolume(volume);
  };

  useEffect(() => {
    const storedVolume = localStorage.getItem('volume');
    if (storedVolume) {
      const volume = parseFloat(storedVolume);
      setVolume(volume);
    }
  }, [volume]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          toggle();
          break;
        case 'arrowright':
          e.preventDefault();
          nextSong();
          break;
        case 'arrowleft':
          e.preventDefault();
          previousSong();
          break;
        case 'm':
          e.preventDefault();
          mute();
          break;
        case 's':
          e.preventDefault();
          toggleShuffle();
          break;
        case 'r':
          e.preventDefault();
          toggleRepeat();
          break;
        case 'l':
          e.preventDefault();
          setIsFavorite(!isFavorite);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isPlaying, isFavorite]);

  const mute = () => {
    if (volume == 0) {
      setVolume(1);
    } else {
      setVolume(0);
    }
  };

  // play song when song is selected
  useEffect(() => {
    if (currentSong && audioRef.current) {
      const audio = audioRef.current;
      audio.load();
      audio.play();

      setIsPlaying(true);

      const currentTimeUpdate = () => {
        setCurrectTime(audio.currentTime);
      };

      audio.addEventListener('timeupdate', currentTimeUpdate);

      return () => {
        audio.removeEventListener('timeupdate', currentTimeUpdate);
      };
    }
  }, [currentSong]);

  // play next song
  const nextSong = () => {
    playNext();
    setIsPlaying(true);
  };

  // Play previous song
  const previousSong = () => {
    if (!currentSong || !audioRef.current) return;

    // If we're more than 3 seconds into the song, restart it
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    playPrevious();
    setIsPlaying(true);
  };

  // auto play next song
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else {
        nextSong();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentSong, songData, repeatMode]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (progressRef.current) {
        updateSliderBackground(progressRef.current);
      }
      if (volumeRef.current) {
        updateSliderBackground(volumeRef.current);
      }
    }, 10);

    return () => clearTimeout(timeout);
  }, [currentSong, volume, currectTime]);

  function updateSliderBackground(el: HTMLInputElement) {
    const min = parseFloat(el.min);
    const max = parseFloat(el.max);
    const value = parseFloat(el.value);

    const percent = ((value - min) / (max - min)) * 100;

    el.style.background = `linear-gradient(to right, #B40000 0%, #B40000 ${percent}%, #ddd ${percent}%, #ddd 100%)`;
  }

  const progressRef = useRef<HTMLInputElement>(null);
  const volumeRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {currentSong && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-b from-[#1a0000] to-[#0a0a0a] border-t border-[#B40000]/20">
          <audio
            ref={audioRef}
            src={currentSong?.songFile}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                audioRef.current.volume = volume;
              }
            }}
          />

          {/* Main Player Container */}
          <div className="max-w-screen-2xl mx-auto px-4 py-3">
            {/* Mobile Layout */}
            <div className="flex flex-col gap-2 md:hidden">
              {/* Progress Bar - Top on mobile */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 min-w-[40px]">{formatTime(currectTime)}</span>
                <input
                  ref={progressRef}
                  type="range"
                  min="0"
                  max={currentSong?.duration}
                  value={currectTime}
                  onChange={e => {
                    handleProgressBar(e);
                    updateSliderBackground(e.currentTarget);
                  }}
                  className="music-range flex-1"
                />
                <span className="text-gray-400 min-w-[40px]">
                  {formatTime(currentSong?.duration)}
                </span>
              </div>

              {/* Song Info + Controls */}
              <div className="flex items-center justify-between gap-3">
                {/* Album Art + Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <img
                    className="h-14 w-14 rounded-md object-cover flex-shrink-0"
                    src={currentSong?.coverImage}
                    alt={currentSong?.songName}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate text-white">
                      {truncateByLetters(currentSong?.songName, 25)}
                    </span>
                    <span className="text-xs text-gray-400 truncate">
                      {currentSong.singerName.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setIsFavorite(!isFavorite)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Heart
                      className={`h-5 w-5 ${isFavorite ? 'fill-[#B40000] text-[#B40000]' : 'text-gray-400'}`}
                    />
                  </button>
                  <button
                    onClick={previousSong}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <PreviousButton className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={toggle}
                    className="p-2 bg-gradient-to-r from-[#800000] to-[#B40000] rounded-full hover:scale-105 transition-transform"
                  >
                    {isPlaying ? (
                      <Pause className="h-5 w-5 text-white" fill="white" />
                    ) : (
                      <Play className="h-5 w-5 text-white" fill="white" />
                    )}
                  </button>
                  <button onClick={nextSong} className="p-1 hover:scale-110 transition-transform">
                    <NextButton className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={toggleShuffle}
                    className={`p-1 hover:scale-110 transition-transform ${isShuffled ? 'text-[#B40000]' : 'text-gray-400'}`}
                  >
                    <Shuffle className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:grid md:grid-cols-[1fr_2fr_1fr] md:gap-4 md:items-center">
              {/* Left: Song Info */}
              <div className="flex items-center gap-4 min-w-0">
                <img
                  className="h-16 w-16 rounded-md object-cover flex-shrink-0"
                  src={currentSong?.coverImage}
                  alt={currentSong?.songName}
                />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate text-white">
                    {currentSong?.songName}
                  </span>
                  <span className="text-xs text-gray-400 truncate">
                    {currentSong.singerName.join(', ')}
                  </span>
                </div>
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className="p-2 hover:scale-110 transition-transform flex-shrink-0"
                >
                  <Heart
                    className={`h-5 w-5 ${isFavorite ? 'fill-[#B40000] text-[#B40000]' : 'text-gray-400'}`}
                  />
                </button>
              </div>

              {/* Center: Controls + Progress */}
              <div className="flex flex-col gap-2">
                {/* Playback Controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={toggleShuffle}
                    className={`p-2 hover:scale-110 transition-transform ${isShuffled ? 'text-[#B40000]' : 'text-gray-400'}`}
                    title="Shuffle (S)"
                  >
                    <Shuffle className="h-4 w-4" />
                  </button>
                  <button
                    onClick={previousSong}
                    className="p-2 hover:scale-110 transition-transform"
                    title="Previous (←)"
                  >
                    <PreviousButton className="h-5 w-5 text-gray-300" />
                  </button>
                  <button
                    onClick={toggle}
                    className="p-3 bg-gradient-to-r from-[#800000] to-[#B40000] rounded-full hover:scale-105 transition-transform"
                    title="Play/Pause (Space)"
                  >
                    {isPlaying ? (
                      <Pause className="h-6 w-6 text-white" fill="white" />
                    ) : (
                      <Play className="h-6 w-6 text-white" fill="white" />
                    )}
                  </button>
                  <button
                    onClick={nextSong}
                    className="p-2 hover:scale-110 transition-transform"
                    title="Next (→)"
                  >
                    <NextButton className="h-5 w-5 text-gray-300" />
                  </button>
                  <button
                    onClick={toggleRepeat}
                    className={`p-2 hover:scale-110 transition-transform ${repeatMode !== 'off' ? 'text-[#B40000]' : 'text-gray-400'}`}
                    title="Repeat (R)"
                  >
                    {repeatMode === 'one' ? (
                      <Repeat1 className="h-4 w-4" />
                    ) : (
                      <Repeat className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 min-w-[40px] text-right">
                    {formatTime(currectTime)}
                  </span>
                  <input
                    ref={progressRef}
                    type="range"
                    min="0"
                    max={currentSong?.duration}
                    value={currectTime}
                    onChange={e => {
                      handleProgressBar(e);
                      updateSliderBackground(e.currentTarget);
                    }}
                    className="music-range flex-1"
                  />
                  <span className="text-gray-400 min-w-[40px]">
                    {formatTime(currentSong?.duration)}
                  </span>
                </div>
              </div>

              {/* Right: Volume Control */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={mute}
                  className="p-2 hover:scale-110 transition-transform"
                  title="Mute (M)"
                >
                  {volume >= 0.6 ? (
                    <Volume2 className="h-5 w-5 text-gray-300" />
                  ) : volume >= 0.1 ? (
                    <Volume1 className="h-5 w-5 text-gray-300" />
                  ) : volume >= 0.01 ? (
                    <Volume className="h-5 w-5 text-gray-300" />
                  ) : (
                    <VolumeX className="h-5 w-5 text-gray-300" />
                  )}
                </button>
                <input
                  ref={volumeRef}
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={e => {
                    handleVolumeBar(e);
                    updateSliderBackground(e.currentTarget);
                  }}
                  className="music-range w-24"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
