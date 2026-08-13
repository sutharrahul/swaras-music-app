'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Music } from 'lucide-react';
import PlayList from '@/components/PlayList';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import { SONGS_PER_PAGE, useSongsPage } from '@/hook/query';
import { useSong } from '@/context/SongContextProvider';

/**
 * How many numbered buttons the pager shows at once, before it starts sliding
 * the window along. Odd, so the current page sits in the middle of it.
 */
const PAGER_WINDOW = 5;

/** The page numbers to draw, windowed around the current one. */
function pageWindow(current: number, total: number) {
  const start = Math.max(
    1,
    Math.min(current - Math.floor(PAGER_WINDOW / 2), total - PAGER_WINDOW + 1)
  );
  const end = Math.min(total, start + PAGER_WINDOW - 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function SongsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // The page lives in the URL, not in component state: it survives a reload,
  // it can be linked, and the browser's back button steps through pages the way
  // a reader expects instead of leaving the list entirely. A junk or missing
  // `?page=` falls back to 1 rather than rendering NaN.
  const requested = Number(searchParams.get('page'));
  const page = Number.isInteger(requested) && requested > 0 ? requested : 1;

  const { data, isLoading, isError, refetch, isPlaceholderData } = useSongsPage(page);
  const { playQueue } = useSong();

  const songs = data?.songs ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / SONGS_PER_PAGE));

  const goTo = (next: number) => {
    router.push(next === 1 ? '/songs' : `/songs?page=${next}`, { scroll: false });
  };

  // Spacing here is deliberately tighter than `/artists` and `/albums`: those
  // are card grids that are meant to scroll, this is a fixed ten rows plus a
  // pager and the whole point is that it lands inside one screen. The heading,
  // its count and the pager gap were all trimmed to buy the rows their height.
  return (
    <div className="px-6 py-4 max-w-7xl mx-auto">
      <div className="mb-4 flex items-baseline gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">All songs</h1>
        {!isLoading && !isError && (
          // Beside the heading rather than under it — as its own line it cost a
          // full row of height to say one number.
          <p className="text-sm text-muted-foreground/70">
            {total} song{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {isLoading ? (
        <LoadingSkeleton />
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
          description="Songs appear here once an admin uploads them."
        />
      ) : (
        <>
          {/* Dimmed while the next page is in flight. `keepPreviousData` leaves
              the old rows mounted so the layout does not collapse, which would
              otherwise be indistinguishable from nothing having happened. */}
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
            <PlayList
              songData={songs}
              dataType="allsong"
              showIndex
              // Rows keep counting across pages — page 3 starts at 21, not at 1.
              indexOffset={(page - 1) * SONGS_PER_PAGE}
              compact
              // The visible page becomes the queue. The default id lookup would
              // miss anything past the player's own cached first page.
              onSongSelect={(_song, index) => playQueue(songs, index)}
            />
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Song list pages"
              className="mt-4 flex items-center justify-center gap-1"
            >
              <button
                type="button"
                onClick={() => goTo(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="size-5" />
              </button>

              {pageWindow(page, totalPages).map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => goTo(n)}
                  aria-label={`Page ${n}`}
                  aria-current={n === page ? 'page' : undefined}
                  className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors ${
                    n === page
                      ? 'bg-brand text-primary-foreground'
                      : 'text-foreground hover:bg-secondary'
                  }`}
                >
                  {n}
                </button>
              ))}

              <button
                type="button"
                onClick={() => goTo(page + 1)}
                disabled={page >= totalPages}
                aria-label="Next page"
                className="flex size-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight aria-hidden="true" className="size-5" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}

/**
 * The whole catalogue, ten to a page, reached from the home page's
 * "All songs → Show all".
 *
 * Paginated rather than infinitely scrolled: the home page used to carry the
 * entire list, and at a hundred tracks that was a hundred-row wall with no way
 * to reach the end of it. Numbered pages give a bounded page height and a
 * position you can return to.
 *
 * The `Suspense` boundary is required, not decorative — `useSearchParams()` in a
 * client component opts the route into client-side rendering, and Next fails the
 * production build without one.
 */
export default function SongsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <SongsPageInner />
    </Suspense>
  );
}
