'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Mic2 } from 'lucide-react';

/** Only the fields a card renders — cards never see the full artist record. */
export type ArtistCardData = { name: string; songCount: number; imageUrl: string | null };

/**
 * One artist card. Unlike `SongCard` this is a <Link>, not a <button>: it
 * navigates rather than plays, so there is no hover play badge and none of that
 * component's nested-interactive workaround is needed.
 *
 * `encodeURIComponent` matches how `ExpandedPlayer` links to an artist; the
 * `safeDecode()` in `/artist/[name]/page.tsx` is what makes a name containing
 * `/`, `&` or `?` round-trip instead of being read as URL syntax.
 *
 * The root is `w-full` rather than `SongCard`'s `w-40 flex-none` on purpose: the
 * width comes from the container, so this one component serves both the home
 * rail (`<li className="w-40 flex-none">`) and the `/artists` grid cell.
 */
export default function ArtistCard({ artist }: { artist: ArtistCardData }) {
  return (
    <Link
      href={`/artist/${encodeURIComponent(artist.name)}`}
      className="group block w-full rounded-lg bg-card p-2.5 text-center transition-colors hover:bg-surface-strong"
    >
      <span className="relative block aspect-square w-full overflow-hidden rounded-full bg-surface-strong">
        {artist.imageUrl ? (
          <Image src={artist.imageUrl} alt="" fill sizes="160px" className="object-cover" />
        ) : (
          // Deliberately not `/assets/songicon.png`: a music note on a round
          // portrait reads as "this is a song", which is the one thing this card
          // is not. A mic glyph says "artist" even with no photo uploaded yet.
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <Mic2 className="size-8 text-muted-foreground/60" />
          </span>
        )}
      </span>

      <span className="mt-2.5 block truncate text-sm font-semibold text-foreground">
        {artist.name}
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {artist.songCount} song{artist.songCount !== 1 ? 's' : ''}
      </span>
    </Link>
  );
}
