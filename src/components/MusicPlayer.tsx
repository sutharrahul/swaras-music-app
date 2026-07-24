'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
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
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useMediaSession } from '@/hooks/useMediaSession';
import toast from 'react-hot-toast';

/**
 * Repaints the shadcn Slider to match the player's scrubber: a fat 8px track
 * with a light unfilled remainder and a brand-red, white-ringed thumb.
 */
const SCRUBBER =
  '[&_[data-slot=slider-track]]:h-2 [&_[data-slot=slider-track]]:bg-track ' +
  '[&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-2 ' +
  '[&_[data-slot=slider-thumb]]:border-white [&_[data-slot=slider-thumb]]:bg-primary';

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

  /**
   * A track with no playback URL. The server signs one for every caller,
   * anonymous included, so this is not "you are signed out" — it means the
   * `songs` row points at a Storage object that is missing, or signing failed.
   *
   * Either way it must be said out loud. The bar used to mount `<audio>` with no
   * `src`, `play()` rejected into the existing catch, and the listener got a
   * player that looked live and produced silence with no explanation.
   */
  const audioUrl = currentSong?.audioUrl ?? null;
  const unplayable = Boolean(currentSong) && !audioUrl;

  useEffect(() => {
    if (!unplayable) return;
    setIsPlaying(false);
    toast.error(`“${currentSong?.title ?? 'This track'}” is unavailable right now.`);
  }, [unplayable, currentSong?.id, currentSong?.title]);

  // `play()` rejects on autoplay blocks and on a src that fails to load. An
  // unhandled rejection leaves the UI claiming it is playing when it is not.
  const safePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch(() => setIsPlaying(false));
  }, []);

  // play paush button
  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      safePlay();
    }
  };

  // handel progressbar
  const handleProgressBar = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }

    setCurrectTime(time);
  };

  // Volume contol
  const handleVolumeBar = (nextVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
    }
    localStorage.setItem('volume', nextVolume.toString());
    setVolume(nextVolume);
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

      // Never swallow the keys a focused control needs for itself — Space on a
      // button, arrows on a slider. Without this, no button in the app can be
      // activated from the keyboard.
      const target = e.target instanceof Element ? e.target : null;
      const onControl = target?.closest('button, a, [role="button"], [role="menuitem"]');
      const onSlider = target?.closest('[role="slider"]');

      switch (e.key.toLowerCase()) {
        case ' ':
          if (onControl || onSlider) return;
          e.preventDefault();
          toggle();
          break;
        case 'arrowright':
          if (onSlider) return;
          e.preventDefault();
          nextSong();
          break;
        case 'arrowleft':
          if (onSlider) return;
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
      audio.play().catch(() => setIsPlaying(false));

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
    if (!currentSong) return;

    // Always go to previous song (removed restart logic)
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
        audio.play().catch(() => setIsPlaying(false));
      } else {
        nextSong();
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentSong, songData, repeatMode]);

  const pauseFromMediaSession = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const playFromMediaSession = useCallback(() => {
    setIsPlaying(true);
    safePlay();
  }, [safePlay]);

  const nextFromMediaSession = useCallback(() => {
    playNext();
    setIsPlaying(true);
  }, [playNext]);

  const previousFromMediaSession = useCallback(() => {
    playPrevious();
    setIsPlaying(true);
  }, [playPrevious]);

  useMediaSession({
    track: currentSong,
    isPlaying,
    onPlay: playFromMediaSession,
    onPause: pauseFromMediaSession,
    onNextTrack: nextFromMediaSession,
    onPreviousTrack: previousFromMediaSession,
  });

  const duration = Math.max(currentSong?.duration ?? 0, 1);
  const playLabel = isPlaying ? 'Pause' : 'Play';
  const repeatLabel =
    repeatMode === 'one' ? 'Repeat one' : repeatMode === 'all' ? 'Repeat all' : 'Repeat off';
  const favoriteLabel = isFavorite ? 'Remove from favourites' : 'Add to favourites';
  const muteLabel = volume === 0 ? 'Unmute' : 'Mute';

  const VolumeIcon =
    volume >= 0.6 ? Volume2 : volume >= 0.1 ? Volume1 : volume >= 0.01 ? Volume : VolumeX;

  return (
    <>
      {currentSong && !unplayable && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-b from-brand-tint to-surface-deep border-t border-brand/20 pb-[env(safe-area-inset-bottom)]">
          <audio
            ref={audioRef}
            // Never null here — the bar is not rendered without a URL, so there
            // is no such thing as a player with nothing to play.
            src={audioUrl ?? undefined}
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
                <span className="text-muted-foreground min-w-[40px]">
                  {formatTime(currectTime)}
                </span>
                <Slider
                  aria-label="Seek"
                  min={0}
                  max={duration}
                  step={1}
                  value={[Math.min(currectTime, duration)]}
                  onValueChange={([value]) => handleProgressBar(value)}
                  className={`flex-1 ${SCRUBBER}`}
                />
                <span className="text-muted-foreground min-w-[40px]">
                  {formatTime(currentSong?.duration)}
                </span>
              </div>

              {/* Song Info + Controls */}
              <div className="flex items-center justify-between gap-3">
                {/* Album Art + Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Image
                    className="h-14 w-14 rounded-md object-cover flex-shrink-0"
                    src={currentSong?.coverUrl || '/assets/songicon.png'}
                    alt=""
                    width={56}
                    height={56}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-semibold truncate text-white">
                      {truncateByLetters(currentSong?.title, 25)}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      {currentSong.artist.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setIsFavorite(!isFavorite)}
                    aria-label={favoriteLabel}
                    aria-pressed={isFavorite}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Heart
                      aria-hidden="true"
                      className={`h-5 w-5 ${isFavorite ? 'fill-brand text-brand' : 'text-muted-foreground'}`}
                    />
                  </button>
                  <button
                    onClick={previousSong}
                    aria-label="Previous song"
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <PreviousButton className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={toggle}
                    aria-label={playLabel}
                    className="p-2 bg-brand-gradient rounded-full hover:scale-105 transition-transform"
                  >
                    {isPlaying ? (
                      <Pause aria-hidden="true" className="h-5 w-5 text-white" fill="white" />
                    ) : (
                      <Play aria-hidden="true" className="h-5 w-5 text-white" fill="white" />
                    )}
                  </button>
                  <button
                    onClick={nextSong}
                    aria-label="Next song"
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <NextButton className="h-4 w-4 text-white" />
                  </button>
                  <button
                    onClick={toggleShuffle}
                    aria-label="Shuffle"
                    aria-pressed={isShuffled}
                    className={`p-1 hover:scale-110 transition-transform ${isShuffled ? 'text-brand' : 'text-muted-foreground'}`}
                  >
                    <Shuffle aria-hidden="true" className="h-4 w-4" />
                  </button>
                  <button
                    onClick={toggleRepeat}
                    aria-label={repeatLabel}
                    className={`p-1 hover:scale-110 transition-transform ${repeatMode !== 'off' ? 'text-brand' : 'text-muted-foreground'}`}
                  >
                    {repeatMode === 'one' ? (
                      <Repeat1 aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <Repeat aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={mute}
                    aria-label={muteLabel}
                    className="p-1 hover:scale-110 transition-transform text-muted-foreground"
                  >
                    <VolumeIcon aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Layout */}
            <div className="hidden md:grid md:grid-cols-[1fr_2fr_1fr] md:gap-4 md:items-center">
              {/* Left: Song Info */}
              {/* Between md and lg this column is only ~a quarter of a narrow
                  bar, so the artwork stays small and the album line is dropped
                  rather than truncating the title to three letters. */}
              <div className="flex items-center gap-2.5 lg:gap-4 min-w-0">
                <Image
                  className="h-12 w-12 lg:h-16 lg:w-16 rounded-md object-cover flex-shrink-0 shadow-lg ring-1 ring-border/60"
                  src={currentSong?.coverUrl || '/assets/songicon.png'}
                  alt=""
                  width={64}
                  height={64}
                />
                <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                  <span className="text-sm lg:text-[15px] font-semibold leading-tight truncate text-white">
                    {currentSong?.title}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">
                    {currentSong.artist.join(', ')}
                  </span>
                  {currentSong?.album && (
                    <span className="hidden lg:block text-[11px] text-muted-foreground/70 truncate">
                      {currentSong.album}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  aria-label={favoriteLabel}
                  aria-pressed={isFavorite}
                  className="p-1.5 lg:p-2 hover:scale-110 transition-transform flex-shrink-0"
                >
                  <Heart
                    aria-hidden="true"
                    className={`h-5 w-5 ${isFavorite ? 'fill-brand text-brand' : 'text-muted-foreground'}`}
                  />
                </button>
              </div>

              {/* Center: Controls + Progress */}
              <div className="flex flex-col gap-2">
                {/* Playback Controls */}
                <div className="flex items-center justify-center gap-4">
                  <Tooltip>
                    <TooltipTrigger
                      onClick={toggleShuffle}
                      aria-label="Shuffle"
                      aria-pressed={isShuffled}
                      className={`p-2 hover:scale-110 transition-transform ${isShuffled ? 'text-brand' : 'text-muted-foreground'}`}
                    >
                      <Shuffle aria-hidden="true" className="h-4 w-4" />
                    </TooltipTrigger>
                    <TooltipContent>Shuffle (S)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      onClick={previousSong}
                      aria-label="Previous song"
                      className="p-2 hover:scale-110 transition-transform"
                    >
                      <PreviousButton className="h-5 w-5 text-foreground/80" />
                    </TooltipTrigger>
                    <TooltipContent>Previous (←)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      onClick={toggle}
                      aria-label={playLabel}
                      className="p-3 bg-brand-gradient rounded-full hover:scale-105 transition-transform"
                    >
                      {isPlaying ? (
                        <Pause aria-hidden="true" className="h-6 w-6 text-white" fill="white" />
                      ) : (
                        <Play aria-hidden="true" className="h-6 w-6 text-white" fill="white" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>{playLabel} (Space)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      onClick={nextSong}
                      aria-label="Next song"
                      className="p-2 hover:scale-110 transition-transform"
                    >
                      <NextButton className="h-5 w-5 text-foreground/80" />
                    </TooltipTrigger>
                    <TooltipContent>Next (→)</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      onClick={toggleRepeat}
                      aria-label={repeatLabel}
                      className={`p-2 hover:scale-110 transition-transform ${repeatMode !== 'off' ? 'text-brand' : 'text-muted-foreground'}`}
                    >
                      {repeatMode === 'one' ? (
                        <Repeat1 aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Repeat aria-hidden="true" className="h-4 w-4" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>Repeat (R)</TooltipContent>
                  </Tooltip>
                </div>

                {/* Progress Bar */}
                <div className="flex items-center gap-2 text-xs w-full max-w-[420px] mx-auto">
                  <span className="text-muted-foreground min-w-[40px] text-right">
                    {formatTime(currectTime)}
                  </span>
                  <Slider
                    aria-label="Seek"
                    min={0}
                    max={duration}
                    step={1}
                    value={[Math.min(currectTime, duration)]}
                    onValueChange={([value]) => handleProgressBar(value)}
                    className={`flex-1 ${SCRUBBER}`}
                  />
                  <span className="text-muted-foreground min-w-[40px]">
                    {formatTime(currentSong?.duration)}
                  </span>
                </div>
              </div>

              {/* Right: Volume Control */}
              <div className="flex items-center justify-end gap-3">
                <Tooltip>
                  <TooltipTrigger
                    onClick={mute}
                    aria-label={muteLabel}
                    className="p-2 hover:scale-110 transition-transform"
                  >
                    <VolumeIcon aria-hidden="true" className="h-5 w-5 text-foreground/80" />
                  </TooltipTrigger>
                  <TooltipContent>Mute (M)</TooltipContent>
                </Tooltip>
                <Slider
                  aria-label="Volume"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[volume]}
                  onValueChange={([value]) => handleVolumeBar(value)}
                  className={`w-24 ${SCRUBBER}`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
