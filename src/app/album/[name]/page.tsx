'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Disc3, Music2, Play } from 'lucide-react';
import PlayList from '@/components/PlayList';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import { useAlbumsInfinite, useSongsByFilter } from '@/hook/query';
import { useSong } from '@/context/SongContextProvider';

/**
 * `useParams()` does not decode the segment here (verified live against
 * `/artist/[name]`) — so a title with a space or a parenthesis, like the ones
 * `AlbumCard` links to via `encodeURIComponent`, would otherwise both display
 * wrong and match zero songs. Falls back to the raw segment if a hand-typed URL
 * has malformed percent-encoding.
 */
function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function AlbumPage() {
  const params = useParams();
  const name = safeDecode(params.name as string);

  const { data, isLoading, isError, refetch } = useSongsByFilter({ album: name });
  const songs = useMemo(() => data?.pages.flatMap(page => page.songs) ?? [], [data]);

  /**
   * The cover comes from the album LIST, not from a per-album endpoint — there
   * is none, and adding one would be a request for a field that already ships on
   * every row of `/api/albums`. That list is also almost always already in cache
   * (the home rail and `/albums` share this exact query key), so in practice the
   * lookup is free. On a cold deep link the album may not be in a fetched page
   * yet; `find` returns undefined and the `Disc3` fallback renders, which is the
   * same thing that happens for an album whose songs carry no embedded artwork.
   */
  const { data: albumData } = useAlbumsInfinite();
  const coverUrl = useMemo(
    () =>
      albumData?.pages.flatMap(page => page.albums).find(album => album.name === name)?.coverUrl,
    [albumData, name]
  );

  const { playQueue } = useSong();

  /**
   * Swap the tall header for a compact sticky bar once it scrolls away, so the
   * album and the play control stay reachable without scrolling back up.
   *
   * An IntersectionObserver on the header rather than a scroll listener: it
   * fires only on the transition instead of on every scroll frame, and it needs
   * no threshold guesswork tied to the header's height, which changes across
   * three breakpoints. The default viewport root is correct here even though the
   * page scrolls inside a div — the intersection rectangle already accounts for
   * clipping by an ancestor with `overflow: auto`.
   */
  const headerRef = useRef<HTMLElement | null>(null);
  const [isHeaderOffscreen, setIsHeaderOffscreen] = useState(false);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsHeaderOffscreen(!entry.isIntersecting),
      // Shrink the observed region by the height of the app's fixed search bar.
      // Without this the swap only fires once the big header is 100% gone — by
      // which point its last rows have already slid *behind* that bar, so there
      // is a stretch of scrolling with no album name visible anywhere. The
      // negative top margin makes "hidden behind the bar" count as offscreen,
      // which is the moment the compact one should take over.
      { rootMargin: '-80px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The server's total, not `songs.length`: the latter counts only the pages
  // fetched so far, so it caps at 20 and would be a visible lie printed under a
  // full-width banner. Used by BOTH header branches — the count must not change
  // depending on whether the album happens to have artwork.
  const songCount = data?.pages[0]?.pagination.total ?? songs.length;

  return (
    <div className="px-6 pb-6 max-w-7xl mx-auto">
      {/*
        The compact header. `top-0`, NOT `top-header`, even though the app's
        search bar covers the first 5rem: the scroll container already carries
        `pt-header`, and a sticky box insets from that padding, so any offset
        here is *added* to it.

        The wrapper is `h-0`, so it contributes no layout at all and the bar
        inside simply paints over the content. That is what lets this be
        conditionally rendered without shifting the page — mounting a normal
        sticky element at a scrolled-out position would push everything below it
        down by its height. Conditional rather than an opacity toggle so a hidden
        play button is never focusable or announced.
      */}
      <div className="sticky top-0 z-20 h-0">
        {isHeaderOffscreen && (
          <div className="animate-in fade-in -mx-6 flex items-center gap-3 bg-primary px-6 py-3 shadow-lg duration-200 md:px-8">
            {songs.length > 0 && (
              <button
                type="button"
                onClick={() => playQueue(songs)}
                aria-label={`Play all songs from ${name}`}
                className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-brand text-primary-foreground transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Play aria-hidden="true" className="size-4" fill="currentColor" />
              </button>
            )}
            <span className="truncate text-lg font-bold text-primary-foreground">{name}</span>
          </div>
        )}
      </div>

      {/*
        Cover beside the title, not a full-bleed banner behind it — a banner is
        far wider than it is tall, so `object-cover` throws most of a square
        sleeve away and no `object-position` gets that right for every record.

        One header for both states, deliberately: the artwork/no-artwork split
        must not become two layouts that drift into printing different song
        counts. Only the contents of the tile change.

        `-mx-6` cancels the page's `p-6` so the tinted band runs edge-to-edge
        inside the `max-w-7xl` column.
      */}
      <section ref={headerRef} className="-mx-6 mb-8 bg-primary px-6 py-8 md:px-8 md:py-10">
        <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-end md:gap-8 md:text-left">
          {/* `rounded-md`, not the artist page's `rounded-full`: cover art is
              square and composed to its own corners, so a circular crop cuts the
              artwork off. Same call as `AlbumCard`. */}
          <span className="relative block size-40 flex-shrink-0 overflow-hidden rounded-md bg-primary-foreground/10 shadow-2xl md:size-52">
            {coverUrl ? (
              <Image src={coverUrl} alt="" fill priority sizes="208px" className="object-cover" />
            ) : (
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center"
              >
                <Disc3 className="size-16 text-primary-foreground/40" />
              </span>
            )}
          </span>

          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold tracking-tight text-primary-foreground break-words md:text-6xl lg:text-7xl">
              {name}
            </h1>
            {!isLoading && !isError && (
              <p className="mt-3 text-sm text-primary-foreground/80 md:text-base">
                {songCount} song{songCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Hidden until there is something to play, rather than rendered disabled:
          a dead control on an empty or still-loading page reads as broken. */}
      {songs.length > 0 && (
        // `px-2 md:px-8` matches the gutter that `Shelf`, `PlayList` and the
        // "Songs" heading all carry. Without it the button sits flush to the page
        // padding while everything below it is inset another 32px, so the one
        // primary action on the page would be the only thing off the column edge.
        <div className="mb-6 flex items-center gap-4 px-2 md:px-8">
          <button
            type="button"
            onClick={() => playQueue(songs)}
            aria-label={`Play all songs from ${name}`}
            className="flex size-14 items-center justify-center rounded-full bg-brand text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {/* `fill="currentColor"` — lucide draws outlines, and a hollow play
                triangle inside a solid circle reads as an outline button. */}
            <Play aria-hidden="true" className="size-6" fill="currentColor" />
          </button>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <ErrorState
          title="We could not load these songs"
          description="The request failed on the way out. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : songs.length === 0 ? (
        <EmptyState
          icon={Music2}
          title="No songs found"
          description={`No songs on ${name} were found.`}
        />
      ) : (
        <>
          {/* "Songs", not "Tracklist": these are ordered by upload date, not by
              the album's own track numbers, which this app does not store. */}
          <h2 className="mb-3 px-2 text-lg font-bold tracking-tight text-foreground md:px-8">
            Songs
          </h2>
          <PlayList songData={songs} dataType="allsong" showIndex />
        </>
      )}
    </div>
  );
}
