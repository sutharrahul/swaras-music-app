'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ChevronDown,
  Heart,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  Volume,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';

import NextButton from '@/assets/Icons/NextButton';
import PreviousButton from '@/assets/Icons/PreviousButton';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { SCRUBBER } from '@/components/MusicPlayer';
import { formatTime } from '@/app/utils/formatTime';
import type { SongWithRelations } from '@/types/models';

type ExpandedPlayerProps = {
  song: SongWithRelations;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPlaying: boolean;
  currentTime: number;
  onSeek: (time: number) => void;
  onToggle: () => void;
  onNext: () => void;
  onPrevious: () => void;
  isShuffled: boolean;
  onToggleShuffle: () => void;
  repeatMode: 'off' | 'all' | 'one';
  onToggleRepeat: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  volume: number;
  onVolumeChange: (volume: number) => void;
  onMute: () => void;
};

/**
 * The full-screen "now playing" view, opened by clicking the album art in the
 * mini player. Reuses the mini player's own state/handlers rather than a
 * second audio pipeline — this is a bigger view onto the same playback.
 */
export default function ExpandedPlayer({
  song,
  open,
  onOpenChange,
  isPlaying,
  currentTime,
  onSeek,
  onToggle,
  onNext,
  onPrevious,
  isShuffled,
  onToggleShuffle,
  repeatMode,
  onToggleRepeat,
  isFavorite,
  onToggleFavorite,
  volume,
  onVolumeChange,
  onMute,
}: ExpandedPlayerProps) {
  const duration = Math.max(song.duration ?? 0, 1);
  const playLabel = isPlaying ? 'Pause' : 'Play';
  const repeatLabel =
    repeatMode === 'one' ? 'Repeat one' : repeatMode === 'all' ? 'Repeat all' : 'Repeat off';
  const favoriteLabel = isFavorite ? 'Remove from favourites' : 'Add to favourites';
  const muteLabel = volume === 0 ? 'Unmute' : 'Mute';
  const VolumeIcon =
    volume >= 0.6 ? Volume2 : volume >= 0.1 ? Volume1 : volume >= 0.01 ? Volume : VolumeX;

  // Album and movie are links to their browse pages; genre has no browse page,
  // so it stays plain text. Built as a list (not a joined string) because two
  // of the three parts need to render as `Link`, not text.
  const metaParts: { key: string; content: ReactNode }[] = [];
  if (song.album) {
    metaParts.push({
      key: 'album',
      content: (
        <Link
          href={`/album/${encodeURIComponent(song.album)}`}
          onClick={() => onOpenChange(false)}
          className="hover:text-brand hover:underline transition-colors"
        >
          {song.album}
        </Link>
      ),
    });
  }
  if (song.movie) {
    metaParts.push({
      key: 'movie',
      content: (
        <Link
          href={`/movie/${encodeURIComponent(song.movie)}`}
          onClick={() => onOpenChange(false)}
          className="hover:text-brand hover:underline transition-colors"
        >
          {song.movie}
        </Link>
      ),
    });
  }
  if (song.genre) {
    metaParts.push({ key: 'genre', content: song.genre });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="inset-0 top-0 left-0 z-[70] h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-background p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">Now playing: {song.title}</DialogTitle>

        <DialogClose
          aria-label="Close now playing"
          className="absolute top-4 left-4 rounded-full p-2 text-foreground hover:bg-secondary transition-colors md:top-6 md:left-6"
        >
          <ChevronDown aria-hidden="true" className="h-6 w-6" />
        </DialogClose>

        <div className="flex h-full flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-16 md:px-12">
          <Image
            src={song.coverUrl || '/assets/songicon.png'}
            alt=""
            width={400}
            height={400}
            className="h-56 w-56 flex-shrink-0 rounded-3xl object-cover shadow-2xl ring-1 ring-border/60 md:h-80 md:w-80"
          />

          <div className="flex w-full max-w-md flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground md:text-3xl">{song.title}</h1>
              <button
                type="button"
                onClick={onToggleFavorite}
                aria-label={favoriteLabel}
                aria-pressed={isFavorite}
                className="flex-shrink-0 transition-transform hover:scale-110"
              >
                <Heart
                  aria-hidden="true"
                  className={`h-6 w-6 ${isFavorite ? 'fill-brand text-brand' : 'text-muted-foreground'}`}
                />
              </button>
            </div>
            <p className="text-lg text-muted-foreground">
              {song.artist.map((name, index) => (
                <span key={`${name}-${index}`}>
                  {index > 0 && ', '}
                  <Link
                    href={`/artist/${encodeURIComponent(name)}`}
                    onClick={() => onOpenChange(false)}
                    className="hover:text-brand hover:underline transition-colors"
                  >
                    {name}
                  </Link>
                </span>
              ))}
            </p>
            {metaParts.length > 0 && (
              <p className="text-sm text-muted-foreground/70">
                {metaParts.map((part, index) => (
                  <span key={part.key}>
                    {index > 0 && ' · '}
                    {part.content}
                  </span>
                ))}
              </p>
            )}
          </div>

          <div className="flex w-full max-w-md flex-col gap-2">
            <Slider
              aria-label="Seek"
              min={0}
              max={duration}
              step={1}
              value={[Math.min(currentTime, duration)]}
              onValueChange={([value]) => onSeek(value)}
              className={SCRUBBER}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(song.duration)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={onToggleShuffle}
              aria-label="Shuffle"
              aria-pressed={isShuffled}
              className={`p-2 transition-transform hover:scale-110 ${isShuffled ? 'text-brand' : 'text-muted-foreground'}`}
            >
              <Shuffle aria-hidden="true" className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onPrevious}
              aria-label="Previous song"
              className="p-2 transition-transform hover:scale-110"
            >
              <PreviousButton className="h-6 w-6 text-foreground/80" />
            </button>
            <button
              type="button"
              onClick={onToggle}
              aria-label={playLabel}
              className="rounded-full bg-primary p-5 transition-transform hover:scale-105 hover:bg-primary/90"
            >
              {isPlaying ? (
                <Pause
                  aria-hidden="true"
                  className="h-7 w-7 text-primary-foreground"
                  fill="currentColor"
                />
              ) : (
                <Play
                  aria-hidden="true"
                  className="h-7 w-7 text-primary-foreground"
                  fill="currentColor"
                />
              )}
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next song"
              className="p-2 transition-transform hover:scale-110"
            >
              <NextButton className="h-6 w-6 text-foreground/80" />
            </button>
            <button
              type="button"
              onClick={onToggleRepeat}
              aria-label={repeatLabel}
              className={`p-2 transition-transform hover:scale-110 ${repeatMode !== 'off' ? 'text-brand' : 'text-muted-foreground'}`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Repeat aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
          </div>

          <div className="flex w-full max-w-[220px] items-center gap-3">
            <button
              type="button"
              onClick={onMute}
              aria-label={muteLabel}
              className="flex-shrink-0 text-muted-foreground transition-transform hover:scale-110"
            >
              <VolumeIcon aria-hidden="true" className="h-5 w-5" />
            </button>
            <Slider
              aria-label="Volume"
              min={0}
              max={1}
              step={0.01}
              value={[volume]}
              onValueChange={([value]) => onVolumeChange(value)}
              className={SCRUBBER}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
