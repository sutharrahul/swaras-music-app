'use client';

import React from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { useSong } from '@/context/SongContextProvider';

/** Only the fields a card renders — cards never see the full song record. */
export type ShelfSong = {
  id: string;
  title: string;
  artist: string[];
  coverUrl?: string | null;
};

/**
 * One album-art card in a shelf. The whole card is the play control, so the
 * hover play badge is a plain <span>: a <button> nested inside a <button> is
 * invalid markup and unreachable by keyboard.
 */
export default function SongCard({ song }: { song: ShelfSong }) {
  const { playSong, currentSong } = useSong();
  const isCurrent = song.id === currentSong?.id;

  return (
    <button
      type="button"
      onClick={() => playSong(song.id)}
      aria-current={isCurrent ? 'true' : undefined}
      className={`group w-40 flex-none rounded-lg p-2.5 text-left transition-colors ${
        isCurrent ? 'bg-surface-strong' : 'bg-card hover:bg-surface-strong'
      }`}
    >
      <span className="relative block aspect-square w-full overflow-hidden rounded-md bg-surface-elevated">
        <Image
          src={song.coverUrl || '/assets/songicon.png'}
          alt=""
          fill
          sizes="160px"
          className="object-cover"
        />
        {/* Revealed on hover, and on keyboard focus so it is not mouse-only. */}
        <span
          aria-hidden="true"
          className={`absolute bottom-2 right-2 flex size-9 items-center justify-center rounded-full bg-brand-gradient shadow-lg transition-all duration-200 ${
            isCurrent
              ? 'translate-y-0 opacity-100'
              : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100'
          }`}
        >
          <Play className="size-4 text-white" fill="currentColor" />
        </span>
      </span>

      <span
        className={`mt-2.5 block truncate text-sm font-semibold ${
          isCurrent ? 'text-brand' : 'text-white'
        }`}
      >
        {song.title}
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {song.artist.join(', ')}
      </span>
    </button>
  );
}
