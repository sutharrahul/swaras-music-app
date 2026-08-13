'use client';

import React, { useId, useMemo } from 'react';
import Link from 'next/link';
import PlayList from '@/components/PlayList';
import Shelf from '@/components/Shelf';
import SongCard from '@/components/SongCard';
import ArtistShelf from '@/components/ArtistShelf';
import AlbumShelf from '@/components/AlbumShelf';
import AlbumCard, { AlbumCardData } from '@/components/AlbumCard';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ShelfSkeleton from '@/components/states/ShelfSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import { useAlbumsInfinite, useArtistsInfinite, useSongsInfinite } from '@/hook/query';
import type { SongWithRelations } from '@/types/models';
import { Music } from 'lucide-react';

/**
 * Shelf sizing.
 *
 * `SHELF_MIN` now gates only "Most liked" — whether that ranking is trustworthy
 * at all, not how many cards make a rail look intentional. A short, left-aligned
 * row of two or three cards is a normal partially-filled row, not a broken one;
 * the `Shelf` component's `flex` row (not a grid) never stretches to fake a full
 * rail, so there is no dead space to hide.
 *
 * "Recently added" is a real recency window instead: whatever was uploaded in
 * the last 7 days, however many that is. A count-based gate would have hidden a
 * fresh upload on a young catalogue — which is exactly the case a "recently
 * added" shelf exists for.
 */
const SHELF_MIN = 8;
const SHELF_MAX = 12;
const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How many cards the derived directories (artists, albums) put on the home page
 * before deferring to their "Show all" page.
 *
 * The rails wrap now instead of scrolling sideways, so this is a real budget
 * rather than a soft one: every card past this is a taller home page, not an
 * off-screen one someone might scroll to.
 */
const RAIL_MAX = 10;

/** Share of the smaller shelf that also appears in the other one. */
const overlapRatio = (a: { id: string }[], b: { id: string }[]) => {
  if (a.length === 0 || b.length === 0) return 0;
  const ids = new Set(a.map(song => song.id));
  return b.filter(song => ids.has(song.id)).length / Math.min(a.length, b.length);
};

/**
 * One card in "Recently added", which is the only mixed rail on the page: an
 * admin uploading a 10-track album made ten near-identical song cards that
 * crowded everything else out, so a batch now reads as the single album it was.
 */
type RecentEntry =
  { kind: 'song'; song: SongWithRelations } | { kind: 'album'; album: AlbumCardData };

/**
 * The album a song counts towards, or null when it is untagged. Whitespace-only
 * tags are treated as absent — grouping by ' ' would invent an album nobody
 * named and link to a browse page with nothing on it.
 */
const albumKey = (song: SongWithRelations) => (song.album?.trim() ? song.album : null);

export default function Home() {
  // The player queue reads this same cache entry, so a page loaded here is a
  // page next/previous can walk — and neither side fetches page 1 twice.
  // Only page 1 is ever read here now — `/songs` owns the paging. The shelves
  // below were already frozen to `pages[0]`, so nothing on this page changed
  // shape when the infinite scroll left.
  const { data, isLoading, isError, refetch } = useSongsInfinite();

  // Discovery rail. `isError` is deliberately not destructured: a failed artist
  // fetch must render nothing at all rather than drop an error block into the
  // middle of an otherwise working home page — the rail is a nice-to-have, the
  // song list is the page. `artistData` stays undefined on failure, so the
  // length check below already covers it.
  const { data: artistData, isLoading: isLoadingArtists } = useArtistsInfinite();
  const railArtists = artistData?.pages[0]?.artists.slice(0, RAIL_MAX) ?? [];

  // Same deal for albums, and for the same reason `isError` is left out: a
  // broken discovery rail renders nothing rather than dropping an error block
  // into the middle of a working home page.
  const { data: albumData, isLoading: isLoadingAlbums } = useAlbumsInfinite();
  const railAlbums = albumData?.pages[0]?.albums.slice(0, RAIL_MAX) ?? [];

  const pages = useMemo(() => data?.pages ?? [], [data]);
  const songs = useMemo(() => pages.flatMap(page => page.songs), [pages]);

  // Shelves are frozen to the first page. Re-deriving them as infinite scroll
  // appends pages would reshuffle the cards and shift the list under the reader.
  const shelfSource = pages[0]?.songs ?? [];
  const wholeCatalogLoaded = pages.length > 0 && !pages[0].pagination.hasMore;

  // "Recently added" mixes card types, so it cannot go through `Shelf` — the
  // markup below is `Shelf`'s, inlined, and this is the id it labels itself with.
  const recentHeadingId = useId();

  // Every album the Albums rail has already loaded, by exact name. That request
  // is paid for either way, so a collapsed card can quote the album's TRUE size
  // rather than the handful of its tracks that happen to be inside the recency
  // window — a card reading "3 songs" for a 10-track album is simply false.
  const albumsByName = useMemo(() => {
    const byName = new Map<string, AlbumCardData>();
    for (const page of albumData?.pages ?? []) {
      for (const album of page.albums) byName.set(album.name, album);
    }
    return byName;
  }, [albumData]);

  const { recentlyAdded, mostLiked } = useMemo(() => {
    // The API already orders by createdAt desc, so page one *is* the newest —
    // filtering to the last 7 days and capping at SHELF_MAX is enough; nothing
    // older can sort ahead of something in-window.
    const recentCutoff = Date.now() - RECENT_WINDOW_MS;
    const recentSongs = shelfSource.filter(
      song => new Date(song.createdAt).getTime() >= recentCutoff
    );

    const songsByAlbum = new Map<string, SongWithRelations[]>();
    for (const song of recentSongs) {
      const album = albumKey(song);
      if (!album) continue;
      const group = songsByAlbum.get(album);
      if (group) group.push(song);
      else songsByAlbum.set(album, [song]);
    }

    // Walking the songs in the order they already arrived and emitting each
    // album where its NEWEST track sits is what keeps one mixed rail in strict
    // recency order: a just-uploaded album still lands ahead of yesterday's
    // loose single. Two shelves — albums then songs — could not do that.
    const entries: RecentEntry[] = [];
    const placed = new Set<string>();
    for (const song of recentSongs) {
      const album = albumKey(song);
      const group = album ? songsByAlbum.get(album) : undefined;

      // One recent track is not a batch. Collapsing it would replace the card
      // that names the track with one reading "1 song", which is strictly less
      // than the reader had before — so untagged songs and lone tracks stay
      // song cards.
      if (!album || !group || group.length < 2) {
        entries.push({ kind: 'song', song });
        continue;
      }

      if (placed.has(album)) continue;
      placed.add(album);
      entries.push({
        kind: 'album',
        // The fallback only fires when the album sits past the first loaded
        // page of /api/albums, which takes a catalogue of 24+ albums for
        // something uploaded this week. Undercounting there is acceptable: the
        // alternative is a per-album request on every home page render.
        album: albumsByName.get(album) ?? {
          name: album,
          songCount: group.length,
          coverUrl: group[0].coverUrl,
        },
      });
    }

    const recent = entries.slice(0, SHELF_MAX);

    // "Most liked" is only truthful when the first page held the whole catalog.
    // Ranking a 20-song window by likes would quietly mislabel itself.
    const liked = wholeCatalogLoaded
      ? shelfSource
          .filter(song => (song._count?.likes ?? 0) > 0)
          .sort((a, b) => (b._count?.likes ?? 0) - (a._count?.likes ?? 0))
          .slice(0, SHELF_MAX)
      : [];

    // Two shelves showing mostly the same covers is worse than a single shelf.
    // `overlapRatio` compares song ids and a collapsed album card has none, so
    // it is handed the songs BEHIND the cards on screen. That is still the right
    // question — a "Most liked" rail of Dhurandhar tracks duplicates the
    // Dhurandhar album card next to it whether or not that card carries an id.
    const shownSongs = recent.flatMap(entry =>
      entry.kind === 'album' ? (songsByAlbum.get(entry.album.name) ?? []) : [entry.song]
    );
    const likedIsDistinct = liked.length >= SHELF_MIN && overlapRatio(shownSongs, liked) <= 0.5;

    return { recentlyAdded: recent, mostLiked: likedIsDistinct ? liked : [] };
  }, [shelfSource, wholeCatalogLoaded, albumsByName]);

  return (
    <div className="w-full py-6">
      {isLoading ? (
        <>
          <ShelfSkeleton />
          <LoadingSkeleton />
        </>
      ) : isError ? (
        <ErrorState
          title="We could not load the songs"
          description="The request failed on the way out. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : songs.length === 0 ? (
        <EmptyState
          icon={Music}
          title="No songs yet"
          description="As soon as an admin uploads a track it will appear here."
        />
      ) : (
        <>
          {/* A copy of `Shelf`'s markup rather than a call to it: this is the one
              rail that carries two kinds of card, and splitting it into an album
              shelf and a song shelf would destroy the recency order the entries
              were built in. Each card is wrapped the way its own shelf wraps it
              — `AlbumCard` takes its width from the <li>, `SongCard` sets its
              own. Keep the two in step if `Shelf` ever changes. */}
          {recentlyAdded.length > 0 && (
            <section aria-labelledby={recentHeadingId} className="mb-8">
              <h2
                id={recentHeadingId}
                className="mb-3 px-2 text-lg font-bold tracking-tight text-foreground md:px-8"
              >
                Recently added
              </h2>
              <ul className="flex gap-4 overflow-x-auto no-scrollbar px-2 pb-2 md:px-8">
                {recentlyAdded.map(entry =>
                  entry.kind === 'album' ? (
                    <li key={`album:${entry.album.name}`} className="w-40 flex-none">
                      <AlbumCard album={entry.album} />
                    </li>
                  ) : (
                    <li key={entry.song.id} className="flex-none">
                      <SongCard song={entry.song} />
                    </li>
                  )
                )}
              </ul>
            </section>
          )}
          {mostLiked.length > 0 && <Shelf title="Most liked" songs={mostLiked} />}

          {/* Inside the "there are songs" branch on purpose: no songs means no
              artists, so this needs no empty state of its own. And an empty rail
              is silence, not an error — which is also why it stays invisible
              until the artist migration is applied. */}
          {isLoadingArtists ? (
            <ShelfSkeleton circular />
          ) : railArtists.length > 0 ? (
            <ArtistShelf title="Artists" artists={railArtists} showAllHref="/artists" />
          ) : null}

          {/* No `circular` on the skeleton, unlike the artist rail above: album
              art is square, so the default `rounded-md` placeholder already
              matches the cards that replace it. */}
          {isLoadingAlbums ? (
            <ShelfSkeleton />
          ) : railAlbums.length > 0 ? (
            <AlbumShelf title="Albums" albums={railAlbums} showAllHref="/albums" />
          ) : null}

          {/* A preview of the catalogue, not the catalogue. The infinite scroll
              that used to live here moved to `/songs`: with a hundred tracks it
              turned the home page into a hundred-row wall, so the shelves and
              rails above became things you scrolled past rather than the point
              of the page. Same heading-plus-"Show all" split the artist and
              album rails already use. */}
          <div className="mb-3 flex items-baseline justify-between px-2 md:px-8">
            <h2 className="text-lg font-bold tracking-tight text-foreground">All songs</h2>
            {songs.length > RAIL_MAX && (
              <Link
                href="/songs"
                className="text-sm font-semibold text-brand hover:text-brand-hover"
              >
                Show all
              </Link>
            )}
          </div>
          <PlayList songData={songs.slice(0, RAIL_MAX)} dataType="allsong" />
        </>
      )}
    </div>
  );
}
