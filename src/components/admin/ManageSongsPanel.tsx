'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Heart, Music, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAdminMutations, useSongsInfinite } from '@/hook/query';
import { apiErrorMessage } from '@/hook/apiHooks';
import type { UpdateSongPayload } from '@/hook/apiHooks/useAdminApi';
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type ManageSongsPanelProps = {
  /** Owned by the parent so it can share one toolbar row with the tab switcher. */
  search: string;
  /** Reports the loaded catalogue size up, for the tab's count badge. */
  onCountChange?: (count: number) => void;
};

/** Controlled-input form state — every field is a plain string, converted to
 * the API's shape (arrays / nullable strings) only on submit. */
type EditSongFormState = {
  title: string;
  artist: string;
  composers: string;
  album: string;
  movie: string;
  genre: string;
  lyrics: string;
};

const buildEditForm = (song: SongWithRelations): EditSongFormState => ({
  title: song.title,
  artist: song.artist.join(', '),
  composers: song.composers.join(', '),
  album: song.album ?? '',
  movie: song.movie ?? '',
  genre: song.genre ?? '',
  lyrics: song.lyrics ?? '',
});

/** Comma-separated input -> trimmed, non-empty entries. */
const parseList = (value: string): string[] =>
  value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);

/** Empty input -> null (explicit clear), otherwise the trimmed value. */
const nullableField = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const arraysEqual = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const EMPTY_EDIT_FORM: EditSongFormState = {
  title: '',
  artist: '',
  composers: '',
  album: '',
  movie: '',
  genre: '',
  lyrics: '',
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
  const { deleteSongMutation, updateSongMutation } = useAdminMutations();

  const [songPendingDelete, setSongPendingDelete] = useState<SongWithRelations | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [songBeingEdited, setSongBeingEdited] = useState<SongWithRelations | null>(null);
  const [editForm, setEditForm] = useState<EditSongFormState>(EMPTY_EDIT_FORM);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

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

  const openEditDialog = (song: SongWithRelations) => {
    setSongBeingEdited(song);
    setEditForm(buildEditForm(song));
    setEditErrors({});
  };

  const closeEditDialog = () => {
    setSongBeingEdited(null);
    setEditErrors({});
  };

  const handleEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!songBeingEdited) return;

    const title = editForm.title.trim();
    const artist = parseList(editForm.artist);

    const nextErrors: Record<string, string> = {};
    if (!title) nextErrors.title = 'Title is required';
    if (artist.length === 0) nextErrors.artist = 'At least one artist is required';
    setEditErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const composers = parseList(editForm.composers);
    const album = nullableField(editForm.album);
    const movie = nullableField(editForm.movie);
    const genre = nullableField(editForm.genre);
    const lyrics = nullableField(editForm.lyrics);

    // Only the fields that actually changed go on the wire — keeps the PATCH
    // minimal and avoids re-sending untouched data.
    const changes: Omit<UpdateSongPayload, 'songId'> = {};
    if (title !== songBeingEdited.title) changes.title = title;
    if (!arraysEqual(artist, songBeingEdited.artist)) changes.artist = artist;
    if (!arraysEqual(composers, songBeingEdited.composers)) changes.composers = composers;
    if (album !== songBeingEdited.album) changes.album = album;
    if (movie !== songBeingEdited.movie) changes.movie = movie;
    if (genre !== songBeingEdited.genre) changes.genre = genre;
    if (lyrics !== songBeingEdited.lyrics) changes.lyrics = lyrics;

    if (Object.keys(changes).length === 0) {
      closeEditDialog();
      return;
    }

    updateSongMutation.mutate(
      { songId: songBeingEdited.id, ...changes },
      {
        onSuccess: () => {
          toast.success('Song updated');
          setSongBeingEdited(null);
        },
        onError: error => toast.error(apiErrorMessage(error, 'Failed to update song')),
      }
    );
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every(song => selectedIds.has(song.id));
  const someFilteredSelected = filtered.some(song => selectedIds.has(song.id));

  const toggleSongSelected = (songId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(songId)) next.delete(songId);
      else next.add(songId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      filtered.forEach(song => {
        if (allFilteredSelected) next.delete(song.id);
        else next.add(song.id);
      });
      return next;
    });
  };

  const deleteSelectedSongs = async () => {
    const ids = Array.from(selectedIds);
    setIsBulkDeleting(true);
    const results = await Promise.allSettled(ids.map(id => deleteSongMutation.mutateAsync(id)));
    setIsBulkDeleting(false);
    setSelectedIds(new Set());

    const failed = results.filter(result => result.status === 'rejected').length;
    const succeeded = results.length - failed;

    if (failed === 0) {
      toast.success(`${succeeded} song${succeeded === 1 ? '' : 's'} deleted`);
    } else {
      toast.error(`${succeeded} deleted, ${failed} failed`);
    }
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
        <>
          <div className="flex items-center justify-between gap-3 px-2 py-1.5">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={
                  allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false
                }
                onCheckedChange={toggleSelectAllFiltered}
                aria-label="Select all songs"
              />
              <span className="text-sm text-muted-foreground">Select all</span>
            </div>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
                <button
                  type="button"
                  onClick={() => setBulkDeleteConfirmOpen(true)}
                  disabled={isBulkDeleting}
                  aria-label={`Delete ${selectedIds.size} selected songs`}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-destructive text-destructive text-sm font-medium hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-wait"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Delete selected
                </button>
              </div>
            )}
          </div>

          <ul className="space-y-1">
            {filtered.map(song => (
              <li
                key={song.id}
                className="flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <Checkbox
                    checked={selectedIds.has(song.id)}
                    onCheckedChange={() => toggleSongSelected(song.id)}
                    aria-label={`Select ${song.title}`}
                  />
                  <Image
                    src={song.coverUrl || '/assets/songicon.png'}
                    alt=""
                    width={40}
                    height={40}
                    className="w-9 h-9 md:w-10 md:h-10 object-cover rounded flex-shrink-0"
                  />

                  <button
                    type="button"
                    onClick={() => openEditDialog(song)}
                    aria-label={`Edit ${song.title}`}
                    className="flex flex-col md:grid md:grid-cols-3 md:gap-4 md:flex-1 min-w-0 text-left rounded cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <span className="text-foreground text-sm md:font-semibold truncate">
                      {truncateByLetters(song.title, 25)}
                    </span>
                    <span className="text-muted-foreground text-xs md:text-sm truncate">
                      {truncateByLetters(song.artist.join(', '), 35)}
                    </span>
                    <span className="text-muted-foreground text-xs md:text-sm truncate hidden md:block">
                      {song.album || 'Unknown'}
                    </span>
                  </button>

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
        </>
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

      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} song{selectedIds.size === 1 ? '' : 's'} permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected songs for everyone. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setBulkDeleteConfirmOpen(false);
                deleteSelectedSongs();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={songBeingEdited !== null} onOpenChange={open => !open && closeEditDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit song details</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} noValidate className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="edit-song-title" className="text-sm font-medium text-foreground">
                Title
              </label>
              <Input
                id="edit-song-title"
                value={editForm.title}
                onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                disabled={updateSongMutation.isPending}
                aria-invalid={Boolean(editErrors.title)}
                aria-describedby={editErrors.title ? 'edit-song-title-error' : undefined}
              />
              {editErrors.title && (
                <p id="edit-song-title-error" className="text-sm text-destructive">
                  {editErrors.title}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-song-artist" className="text-sm font-medium text-foreground">
                Artist
              </label>
              <Input
                id="edit-song-artist"
                value={editForm.artist}
                onChange={e => setEditForm(prev => ({ ...prev, artist: e.target.value }))}
                placeholder="Comma-separated, e.g. Shakira, Burna Boy"
                disabled={updateSongMutation.isPending}
                aria-invalid={Boolean(editErrors.artist)}
                aria-describedby={editErrors.artist ? 'edit-song-artist-error' : undefined}
              />
              {editErrors.artist && (
                <p id="edit-song-artist-error" className="text-sm text-destructive">
                  {editErrors.artist}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-song-composers" className="text-sm font-medium text-foreground">
                Composers
              </label>
              <Input
                id="edit-song-composers"
                value={editForm.composers}
                onChange={e => setEditForm(prev => ({ ...prev, composers: e.target.value }))}
                placeholder="Comma-separated"
                disabled={updateSongMutation.isPending}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="edit-song-album" className="text-sm font-medium text-foreground">
                  Album
                </label>
                <Input
                  id="edit-song-album"
                  value={editForm.album}
                  onChange={e => setEditForm(prev => ({ ...prev, album: e.target.value }))}
                  disabled={updateSongMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-song-movie" className="text-sm font-medium text-foreground">
                  Movie / soundtrack
                </label>
                <Input
                  id="edit-song-movie"
                  value={editForm.movie}
                  onChange={e => setEditForm(prev => ({ ...prev, movie: e.target.value }))}
                  disabled={updateSongMutation.isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-song-genre" className="text-sm font-medium text-foreground">
                Genre
              </label>
              <Input
                id="edit-song-genre"
                value={editForm.genre}
                onChange={e => setEditForm(prev => ({ ...prev, genre: e.target.value }))}
                disabled={updateSongMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="edit-song-lyrics" className="text-sm font-medium text-foreground">
                Lyrics
              </label>
              <Textarea
                id="edit-song-lyrics"
                value={editForm.lyrics}
                onChange={e => setEditForm(prev => ({ ...prev, lyrics: e.target.value }))}
                disabled={updateSongMutation.isPending}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={updateSongMutation.isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={updateSongMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {updateSongMutation.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
