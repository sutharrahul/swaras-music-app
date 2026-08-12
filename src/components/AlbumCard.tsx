'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Disc3 } from 'lucide-react';

/** Only the fields a card renders — cards never see the full album record. */
export type AlbumCardData = { name: string; songCount: number; coverUrl: string | null };

/**
 * One album card. Like `ArtistCard` this is a <Link>, not a <button>: it
 * navigates rather than plays, so there is no hover play badge and none of
 * `SongCard`'s nested-interactive workaround is needed.
 *
 * `encodeURIComponent` pairs with the `safeDecode()` in `/album/[name]/page.tsx`,
 * which is what makes a title containing `/`, `&` or `?` round-trip instead of
 * being read as URL syntax.
 *
 * The root is `w-full` rather than `SongCard`'s `w-40 flex-none` on purpose: the
 * width comes from the container, so this one component serves both the home
 * rail (`<li className="w-40 flex-none">`) and the `/albums` grid cell.
 */
export default function AlbumCard({ album }: { album: AlbumCardData }) {
  return (
    <Link
      href={`/album/${encodeURIComponent(album.name)}`}
      // `text-left`, not `ArtistCard`'s `text-center`: album titles are long and
      // wrap ("Dhurandhar (Original Motion Picture Soundtrack)"), and centred
      // ragged text reads badly. `SongCard` aligns left for the same reason.
      // Artist names are short enough that centring them stays tidy.
      className="group block w-full rounded-lg bg-card p-2.5 text-left transition-colors hover:bg-surface-strong"
    >
      {/*
        `rounded-md`, not `ArtistCard`'s `rounded-full`. Cover art is square by
        universal convention and is composed to its own corners — a circular crop
        cuts the artwork off. A round portrait is right for a person and wrong
        for a record sleeve. Matches `SongCard`'s art, which shows the same
        images.
      */}
      <span className="relative block aspect-square w-full overflow-hidden rounded-md bg-surface-strong">
        {album.coverUrl ? (
          <Image src={album.coverUrl} alt="" fill sizes="160px" className="object-cover" />
        ) : (
          // Deliberately not `/assets/songicon.png`: a music note says "this is a
          // song", which is the one thing this card is not. A disc glyph says
          // "album" even when none of its songs carried embedded artwork.
          <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
            <Disc3 className="size-8 text-muted-foreground/60" />
          </span>
        )}
      </span>

      <span className="mt-2.5 block truncate text-sm font-semibold text-foreground">
        {album.name}
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {album.songCount} song{album.songCount !== 1 ? 's' : ''}
      </span>
    </Link>
  );
}
