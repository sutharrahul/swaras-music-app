'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { Heart, Music, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAdminMutations, useSongsInfinite } from '@/hook/query';
import { apiErrorMessage } from '@/hook/apiHooks';
import type { SongWithRelations } from '@/types/models';
import { formatTime } from '@/app/utils/formatTime';
import { truncateByLetters } from '@/app/utils/truncateByLetters';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type ManageSongsPanelProps = {
  /** Owned by the parent so it can share one toolbar row with the tab switcher. */
  search: string;
  /** Reports the loaded catalogue size up, for the tab's count badge. */
  onCountChange?: (count: number) => void;
};

/**
 * The catalogue is small and stays that way for a while, so this drives
 * `useSongsInfinite` to the end (all pages) once and filters client-side as
 * the admin types — the same list the home page renders, no separate search
 * endpoint.
 */
export default function ManageSongsPanel({ search, onCountChange }: ManageSongsPanelProps) {
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSongsInfinite();
  const { deleteSongMutation } = useAdminMutations();

  const [songPendingDelete, setSongPendingDelete] = useState<SongWithRelations | null>(null);

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const songs = useMemo(() => data?.pages.flatMap(page => page.songs) ?? [], [data]);

  useEffect(() => {
    onCountChange?.(songs.length);
  }, [songs.length, onCountChange]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return songs;
    return songs.filter(
      song =>
        song.title.toLowerCase().includes(query) ||
        song.artist.some(artist => artist.toLowerCase().includes(query))
    );
  }, [songs, search]);

  const deleteSong = (songId: string) => {
    deleteSongMutation.mutate(songId, {
      onSuccess: () => toast.success('Song deleted successfully'),
      onError: error => toast.error(apiErrorMessage(error, 'Failed to delete song')),
    });
  };

  return (
    <div className="px-2 md:px-8 py-4">
      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <ErrorState
          title="We could not load the songs"
          description="The request failed on the way out. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Music}
          title={search ? 'No songs match your search' : 'No songs yet'}
          description={search ? undefined : 'Upload a track to see it here.'}
        />
      ) : (
        <ul className="space-y-1">
          {filtered.map(song => (
            <li
              key={song.id}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                <Image
                  src={song.coverUrl || '/assets/songicon.png'}
                  alt=""
                  width={40}
                  height={40}
                  className="w-9 h-9 md:w-10 md:h-10 object-cover rounded flex-shrink-0"
                />

                <div className="flex flex-col md:grid md:grid-cols-3 md:gap-4 md:flex-1 min-w-0">
                  <span className="text-white text-sm md:font-semibold truncate">
                    {truncateByLetters(song.title, 25)}
                  </span>
                  <span className="text-muted-foreground text-xs md:text-sm truncate">
                    {truncateByLetters(song.artist.join(', '), 35)}
                  </span>
                  <span className="text-muted-foreground text-xs md:text-sm truncate hidden md:block">
                    {song.album || 'Unknown'}
                  </span>
                </div>

                <span className="text-muted-foreground text-sm mx-3 hidden md:inline flex-shrink-0">
                  {formatTime(Math.floor(song.duration))}
                </span>
              </div>

              <div className="flex items-center gap-3 md:gap-4 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <Heart
                    aria-hidden="true"
                    className="h-3 w-3 md:h-4 md:w-4 text-brand fill-brand"
                  />
                  <span className="text-muted-foreground text-xs md:text-sm">
                    {song._count?.likes || 0}
                  </span>
                  <span className="sr-only">likes</span>
                </div>

                <button
                  type="button"
                  onClick={() => setSongPendingDelete(song)}
                  disabled={
                    deleteSongMutation.isPending && deleteSongMutation.variables === song.id
                  }
                  aria-label={`Delete ${song.title}`}
                  className="p-1 rounded text-foreground/80 hover:text-destructive disabled:opacity-50 disabled:cursor-wait"
                >
                  <Trash2 aria-hidden="true" className="h-5 w-5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={songPendingDelete !== null}
        onOpenChange={open => !open && setSongPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{songPendingDelete?.title}” permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the song for everyone. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const song = songPendingDelete;
                setSongPendingDelete(null);
                if (song) deleteSong(song.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
