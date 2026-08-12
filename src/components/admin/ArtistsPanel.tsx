'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Image from 'next/image';
import { Mic2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { useArtistMutations, useArtistProfile, useArtistsInfinite } from '@/hook/query';
import { apiErrorMessage } from '@/hook/apiHooks';
import type { ArtistSummary } from '@/hook/apiHooks/useArtistApi';
import { ALLOWED_COVER_TYPES, MAX_COVER_BYTES } from '@/lib/storage';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import EmptyState from '@/components/states/EmptyState';
import ErrorState from '@/components/states/ErrorState';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

/** Mirrors the `.max(2000)` on the route's zod schema. */
const BIO_MAX_LENGTH = 2000;

type ArtistsPanelProps = {
  /** Owned by the parent so it can share one toolbar row with the tab switcher. */
  search: string;
  /** Reports the loaded artist count up, for the tab's count badge. */
  onCountChange?: (count: number) => void;
};

/**
 * Artist photos.
 *
 * Artists have no rows of their own — they are derived from `songs.artist`, so
 * this list is only ever as long as the catalogue's distinct tags. Same call as
 * the songs panel makes: drive the infinite query to the end once and filter
 * client-side as the admin types, rather than add a search endpoint for a list
 * this size.
 */
export default function ArtistsPanel({ search, onCountChange }: ArtistsPanelProps) {
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useArtistsInfinite();
  const { uploadArtistPhotoMutation, removeArtistPhotoMutation, saveArtistProfileMutation } =
    useArtistMutations();

  const [artistBeingEdited, setArtistBeingEdited] = useState<ArtistSummary | null>(null);
  const [artistPendingPhotoRemoval, setArtistPendingPhotoRemoval] = useState<ArtistSummary | null>(
    null
  );
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Deliberately NOT `artistBeingEdited`: that one drives the photo dialog, and
  // two dialogs reading one state variable open together.
  const [artistBioTarget, setArtistBioTarget] = useState<ArtistSummary | null>(null);
  const [bioDraft, setBioDraft] = useState('');

  const isPending = uploadArtistPhotoMutation.isPending;
  const isRemoving = removeArtistPhotoMutation.isPending;
  const isSavingBio = saveArtistProfileMutation.isPending;

  // `ArtistSummary` carries no bio — the list endpoint does not return one — so
  // the existing text has to be fetched per artist. `useArtistProfile` is
  // `enabled`-guarded on a falsy name, so the closed dialog's `''` costs nothing.
  const { data: bioProfile, isLoading: isBioLoading } = useArtistProfile(
    artistBioTarget?.name ?? ''
  );

  // An empty box while the stored bio is still in flight is indistinguishable
  // from "this artist has no bio", and saving it would wipe whatever is already
  // written. Covers the failed-fetch case too, where `isLoading` is false but
  // there is still nothing to edit against.
  const isBioUnavailable = artistBioTarget !== null && bioProfile === undefined;
  const isBioOverLimit = bioDraft.length > BIO_MAX_LENGTH;

  const removePhoto = (artist: ArtistSummary) => {
    setArtistPendingPhotoRemoval(null);
    removeArtistPhotoMutation.mutate(artist.name, {
      onSuccess: () => toast.success(`Photo removed for ${artist.name}`),
      onError: error => toast.error(apiErrorMessage(error, 'Failed to remove the photo')),
    });
  };

  // `isFetchNextPageError` is load-bearing, not defensive padding. `hasNextPage`
  // is derived from the last SUCCESSFUL page, so it stays true after a rejection,
  // and `isFetchingNextPage` flips back to false — which is itself a dep of this
  // effect. Without the guard a single failed page re-arms the effect that just
  // failed, and it hammers the endpoint for as long as the tab is open, behind a
  // static error state that never changes to say so.
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isFetchNextPageError) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const artists = useMemo(() => data?.pages.flatMap(page => page.artists) ?? [], [data]);

  useEffect(() => {
    onCountChange?.(artists.length);
  }, [artists.length, onCountChange]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return artists;
    return artists.filter(artist => artist.name.toLowerCase().includes(query));
  }, [artists, search]);

  /**
   * The blob URL's entire lifetime hangs off `file`, so there is exactly one
   * place that revokes it: this cleanup. It fires on a re-pick, on the
   * `setFile(null)` that closing the dialog does, and on unmount. Revoking by
   * hand at each of those call sites is what leaks an image the one time a path
   * is missed.
   */
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const openDialog = (artist: ArtistSummary) => {
    setArtistBeingEdited(artist);
    setFile(null);
  };

  const closeDialog = () => {
    setArtistBeingEdited(null);
    setFile(null);
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) return;

    // Rejecting here only buys a useful message before a mint and a
    // multi-megabyte PUT — the bucket's own `file_size_limit` and mime
    // allowlist are the checks a client cannot talk its way past.
    if (!ALLOWED_COVER_TYPES.includes(picked.type as (typeof ALLOWED_COVER_TYPES)[number])) {
      toast.error(`"${picked.name}" is not a JPEG, PNG, WebP or GIF.`);
      event.target.value = '';
      return;
    }
    if (picked.size > MAX_COVER_BYTES) {
      toast.error(`"${picked.name}" is larger than 10MB.`);
      event.target.value = '';
      return;
    }

    setFile(picked);
  };

  const handleSubmit = () => {
    if (!artistBeingEdited || !file) return;

    uploadArtistPhotoMutation.mutate(
      { name: artistBeingEdited.name, file },
      {
        onSuccess: () => {
          toast.success('Artist photo updated');
          closeDialog();
        },
        onError: error => toast.error(apiErrorMessage(error, 'Failed to upload the photo')),
      }
    );
  };

  /**
   * Seed the textarea once the fetched profile lands. Keyed on both the open
   * artist and the resolved profile, so re-opening a second artist re-seeds and
   * a closed dialog (`artistBioTarget === null`, and therefore no profile) is
   * left alone. React Query's structural sharing keeps `bioProfile` referentially
   * stable across a refetch that returns the same bio, so a draft in progress is
   * not overwritten under the admin's cursor.
   */
  useEffect(() => {
    if (!artistBioTarget || !bioProfile) return;
    setBioDraft(bioProfile.bio ?? '');
  }, [artistBioTarget, bioProfile]);

  const openBioDialog = (artist: ArtistSummary) => {
    setArtistBioTarget(artist);
    // Cleared rather than left as-is: the effect above may not have run yet for
    // this artist, and the previous artist's bio must not be sitting in the box.
    setBioDraft('');
  };

  const closeBioDialog = () => {
    setArtistBioTarget(null);
    setBioDraft('');
  };

  const handleBioSubmit = () => {
    if (!artistBioTarget || isBioUnavailable || isBioOverLimit) return;

    const trimmed = bioDraft.trim();

    saveArtistProfileMutation.mutate(
      // An emptied box is how a bio is cleared. The server maps `''` to null
      // anyway, but sending null says so outright.
      { name: artistBioTarget.name, bio: trimmed === '' ? null : trimmed },
      {
        onSuccess: () => {
          toast.success('Artist bio saved');
          closeBioDialog();
        },
        onError: error => toast.error(apiErrorMessage(error, 'Failed to save the bio')),
      }
    );
  };

  return (
    <div className="px-2 md:px-8 py-4">
      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <ErrorState
          title="We could not load the artists"
          description="The request failed on the way out. Try again in a moment."
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Mic2}
          title={search ? 'No artists match your search' : 'No artists yet'}
          description={search ? undefined : 'Upload a track and its artists appear here.'}
        />
      ) : (
        <ul className="space-y-1">
          {filtered.map(artist => (
            <li
              key={artist.name}
              className="flex items-center justify-between gap-3 px-2 py-1.5 rounded hover:bg-accent/40 transition-colors"
            >
              <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                {artist.imageUrl ? (
                  <Image
                    src={artist.imageUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-surface-strong flex items-center justify-center flex-shrink-0">
                    <Mic2 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                  </span>
                )}

                <div className="flex flex-col min-w-0">
                  <span className="text-foreground text-sm md:font-semibold truncate">
                    {artist.name}
                  </span>
                  <span className="text-muted-foreground text-xs md:text-sm">
                    {artist.songCount} {artist.songCount === 1 ? 'song' : 'songs'}
                  </span>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openBioDialog(artist)}
                  aria-label={`Edit bio for ${artist.name}`}
                >
                  Edit bio
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDialog(artist)}
                  aria-label={`${artist.imageUrl ? 'Replace' : 'Add'} photo for ${artist.name}`}
                >
                  {artist.imageUrl ? 'Replace' : 'Add photo'}
                </Button>

                {/* Only offered when there is something to remove — an always-on
                    destructive control next to "Add photo" would be a trap. */}
                {artist.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setArtistPendingPhotoRemoval(artist)}
                    disabled={isRemoving}
                    aria-label={`Remove photo for ${artist.name}`}
                    className="rounded p-1 text-foreground/80 hover:text-destructive disabled:cursor-wait disabled:opacity-50"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={artistBeingEdited !== null} onOpenChange={open => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Photo for {artistBeingEdited?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="artist-photo" className="text-sm font-medium text-foreground">
                Artist photo
              </label>
              <input
                id="artist-photo"
                type="file"
                accept={ALLOWED_COVER_TYPES.join(',')}
                onChange={handleFile}
                disabled={isPending}
                className="text-sm font-light rounded-lg block w-full p-2.5 bg-secondary border-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">JPEG, PNG, WebP or GIF, up to 10MB.</p>
            </div>

            {previewUrl && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- a blob: src cannot go through next/image's optimizer, and `unoptimized` would be a workaround for a 128px local preview. */}
                <img src={previewUrl} alt="" className="size-32 rounded-full object-cover" />
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!file || isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isPending ? 'Uploading…' : 'Save photo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={artistBioTarget !== null} onOpenChange={open => !open && closeBioDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bio for {artistBioTarget?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="artist-bio" className="text-sm font-medium text-foreground">
                Bio
              </label>
              <span
                className={`text-xs ${isBioOverLimit ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {bioDraft.length} / {BIO_MAX_LENGTH}
              </span>
            </div>

            <Textarea
              id="artist-bio"
              rows={6}
              value={bioDraft}
              onChange={event => setBioDraft(event.target.value)}
              disabled={isBioUnavailable || isSavingBio}
              placeholder="A short introduction to this artist."
            />

            {isBioUnavailable && (
              <p className="text-xs text-muted-foreground">
                {isBioLoading ? 'Loading the current bio…' : 'The current bio could not be loaded.'}
              </p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isSavingBio}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleBioSubmit}
              disabled={isBioUnavailable || isBioOverLimit || isSavingBio}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSavingBio ? 'Saving…' : 'Save bio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog rather than Dialog, matching how song deletion is confirmed
          in ManageSongsPanel: this is destructive and cannot be undone, so it
          wants the role and the deliberate two-button framing. */}
      <AlertDialog
        open={artistPendingPhotoRemoval !== null}
        onOpenChange={open => !open && setArtistPendingPhotoRemoval(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remove the photo for “{artistPendingPhotoRemoval?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The image is deleted for everyone and cannot be recovered. The artist and their songs
              are untouched — you can upload a new photo at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (artistPendingPhotoRemoval) removePhoto(artistPendingPhotoRemoval);
              }}
            >
              Remove photo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
