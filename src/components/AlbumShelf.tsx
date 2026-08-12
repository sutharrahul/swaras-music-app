'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import AlbumCard, { AlbumCardData } from '@/components/AlbumCard';

/**
 * A horizontally scrolling rail of album cards under a section heading, with a
 * "Show all" escape hatch to the full grid.
 *
 * This is the THIRD near-identical rail (`Shelf`, `ArtistShelf`, `AlbumShelf`).
 * Two was a coincidence; three is a pattern, and extracting a shared rail —
 * heading + "Show all" + the scrolling <ul> — with the card as a render prop is
 * now genuinely worth doing. It is deliberately left as a follow-up so this
 * change stays purely additive: rewriting `Shelf` and `ArtistShelf` to route
 * through a new abstraction risks regressing two rails that already work, in a
 * commit whose job is to add a third.
 *
 * `key={album.name}` is safe because the server groups by name, so the names in
 * a page are already unique.
 */
export default function AlbumShelf({
  title,
  albums,
  showAllHref,
}: {
  title: string;
  albums: AlbumCardData[];
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
        {albums.map(album => (
          <li key={album.name} className="w-40 flex-none">
            <AlbumCard album={album} />
          </li>
        ))}
      </ul>
    </section>
  );
}
