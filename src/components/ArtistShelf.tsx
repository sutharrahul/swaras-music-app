'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import ArtistCard, { ArtistCardData } from '@/components/ArtistCard';

/**
 * A horizontally scrolling rail of artist cards under a section heading, with a
 * "Show all" escape hatch to the full grid.
 *
 * This is a sibling of `Shelf` rather than a generalisation of it: `Shelf` is
 * typed `songs: ShelfSong[]` and hardcodes `SongCard`, so making it serve both
 * would mean a render prop plus a slot for the trailing action — a real refactor
 * of a working component to serve one new caller. CLAUDE.md §3: touch only what
 * you must.
 *
 * `key={artist.name}` is safe because the server groups by name, so the names in
 * a page are already unique.
 */
export default function ArtistShelf({
  title,
  artists,
  showAllHref,
}: {
  title: string;
  artists: ArtistCardData[];
  showAllHref: string;
}) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="mb-8">
      <div className="mb-3 flex items-baseline justify-between px-2 md:px-8">
        <h2 id={headingId} className="text-lg font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <Link
          href={showAllHref}
          className="text-sm font-semibold text-brand hover:text-brand-hover"
        >
          Show all
        </Link>
      </div>
      <ul className="flex gap-4 overflow-x-auto no-scrollbar px-2 pb-2 md:px-8">
        {artists.map(artist => (
          <li key={artist.name} className="w-40 flex-none">
            <ArtistCard artist={artist} />
          </li>
        ))}
      </ul>
    </section>
  );
}
