'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Music2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PlayList from '@/components/PlayList';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import { useSongsByFilter } from '@/hook/query';

/**
 * `useParams()` does not decode the segment here (verified live against
 * `/artist/[name]`) — see that page for details. Falls back to the raw
 * segment if a hand-typed URL has malformed percent-encoding.
 */
function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function MoviePage() {
  const router = useRouter();
  const params = useParams();
  const name = safeDecode(params.name as string);

  const { data, isLoading, isError, refetch } = useSongsByFilter({ movie: name });
  const songs = useMemo(() => data?.pages.flatMap(page => page.songs) ?? [], [data]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <Button
        onClick={() => router.back()}
        variant="ghost"
        className="mb-4 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{name}</h1>
        {!isLoading && !isError && (
          <p className="text-muted-foreground/70">
            {songs.length} song{songs.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

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
          description={`No songs from ${name} were found.`}
        />
      ) : (
        <PlayList songData={songs} dataType="allsong" />
      )}
    </div>
  );
}
