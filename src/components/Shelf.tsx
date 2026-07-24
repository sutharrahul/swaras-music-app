'use client';

import React, { useId } from 'react';
import SongCard, { ShelfSong } from '@/components/SongCard';

/**
 * A horizontally scrolling rail of album-art cards under a section heading.
 *
 * The rail is deliberately not a tab stop of its own: every card inside is a
 * button, so tabbing through them scrolls the rail into view without adding a
 * redundant stop for keyboard users.
 */
export default function Shelf({ title, songs }: { title: string; songs: ShelfSong[] }) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <h2 id={headingId} className="mb-3 px-2 text-lg font-bold tracking-tight text-white md:px-8">
        {title}
      </h2>
      <ul className="flex gap-4 overflow-x-auto px-2 pb-2 md:px-8">
        {songs.map(song => (
          <li key={song.id} className="flex-none">
            <SongCard song={song} />
          </li>
        ))}
      </ul>
    </section>
  );
}
