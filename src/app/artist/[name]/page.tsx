'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Mic2, Music2, Play } from 'lucide-react';
import PlayList from '@/components/PlayList';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import { useArtistProfile, useSongsByFilter } from '@/hook/query';
import { useSong } from '@/context/SongContextProvider';

/**
 * `useParams()` does not decode the segment here (verified live:
 * `/artist/Burna%20Boy` renders as the literal string "Burna%20Boy", not
 * "Burna Boy") — so a name with a space or other encoded character, like the
 * ones `ExpandedPlayer` links to via `encodeURIComponent`, would otherwise
 * both display wrong and match zero songs. Falls back to the raw segment if a
 * hand-typed URL has malformed percent-encoding.
 */
function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function ArtistPage() {
  const params = useParams();
  const name = safeDecode(params.name as string);

  const { data, isLoading, isError, refetch } = useSongsByFilter({ artist: name });
  const songs = useMemo(() => data?.pages.flatMap(page => page.songs) ?? [], [data]);

  const { data: profile } = useArtistProfile(name);
  const { playQueue } = useSong();

  /**
   * Swap the tall header for a compact sticky bar once it scrolls away, so the
   * artist and the play control stay reachable without scrolling back up.
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
      // is a stretch of scrolling with no artist name visible anywhere. The
      // negative top margin makes "hidden behind the bar" count as offscreen,
      // which is the moment the compact one should take over.
      { rootMargin: '-80px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="px-6 pb-6 max-w-7xl mx-auto">
      {/*
        The compact header. `top-0`, NOT `top-header`, even though the app's
        search bar covers the first 5rem: the scroll container already carries
        `pt-header`, and a sticky box insets from that padding, so any offset
        here is *added* to it. Measured — `top-80px` parked the bar at y=160,
        a full header's height too low.

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
                aria-label={`Play all songs by ${name}`}
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
        Avatar beside the name, not a full-bleed banner behind it.
        A banner is far wider than it is tall, so `object-cover` has to throw
        away most of a portrait — which is what people upload for an artist —
        and no choice of `object-position` gets that right for every photo. A
        circle is square, so it crops symmetrically and barely at all.

        One header for both states, deliberately. The photo/no-photo split used
        to render two completely different layouts, which is how the two of them
        drifted into printing different song counts. Now only the contents of
        the circle change.

        `-mx-6` cancels the page's `p-6` so the tinted band runs edge-to-edge
        inside the `max-w-7xl` column.
      */}
      <section ref={headerRef} className="-mx-6 mb-8 bg-primary px-6 py-8 md:px-8 md:py-10">
        {/*
          Cross-axis alignment depends on whether there is a bio, because
          bottom-aligning (the old `md:items-end`) made the name's position a
          function of the bio's length: a three-line bio pushed the name up, a
          two-line bio left it sitting much lower, so no two artist pages lined
          up with each other.

          With a bio, `md:items-start` pins the name to the top of the avatar —
          the same y on every artist page, whatever the bio does below it.
          Without one, the block is just the name and top-aligning it would
          strand it against a 13rem circle, so it centers instead.
        */}
        <div
          className={`flex flex-col items-center gap-6 text-center md:flex-row md:gap-8 md:text-left ${
            profile?.bio ? 'md:items-start' : 'md:items-center'
          }`}
        >
          <span className="relative block size-40 flex-shrink-0 overflow-hidden rounded-full bg-primary-foreground/10 shadow-2xl md:size-52">
            {profile?.imageUrl ? (
              <Image
                src={profile.imageUrl}
                alt=""
                fill
                priority
                sizes="208px"
                className="object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center"
              >
                <Mic2 className="size-16 text-primary-foreground/40" />
              </span>
            )}
          </span>

          <div className="min-w-0">
            <h1 className="text-4xl font-extrabold tracking-tight text-primary-foreground break-words md:text-5xl lg:text-6xl">
              {name}
            </h1>

            {/* Only rendered when there is one, so an artist nobody has written
                about yet gets a clean name rather than an empty paragraph still
                taking its margin. `max-w-2xl` so a long bio wraps into a
                readable column instead of one long line across a wide screen. */}
            {profile?.bio && (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary-foreground/85 md:text-base">
                {profile.bio}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Hidden until there is something to play, rather than rendered disabled:
          a dead control on an empty or still-loading page reads as broken. */}
      {songs.length > 0 && (
        // `px-2 md:px-8` matches the gutter that `Shelf`, `PlayList` and the
        // "Songs" heading all carry. Without it the button sat flush to the page
        // padding while everything below it was inset another 32px, so the one
        // primary action on the page was the only thing off the column edge.
        <div className="mb-6 flex items-center gap-4 px-2 md:px-8">
          <button
            type="button"
            onClick={() => playQueue(songs)}
            aria-label={`Play all songs by ${name}`}
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
          description={`No songs by ${name} were found.`}
        />
      ) : (
        <>
          {/* "Songs", not Spotify's "Popular" — these are ordered by upload
              date, not by plays, and there is no play-count in this app to rank
              them by. Naming it Popular would be a claim the data cannot back. */}
          <h2 className="mb-3 px-2 text-lg font-bold tracking-tight text-foreground md:px-8">
            Songs
          </h2>
          <PlayList songData={songs} dataType="allsong" showIndex />
        </>
      )}
    </div>
  );
}
