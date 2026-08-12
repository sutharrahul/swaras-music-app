'use client';

import { useRef, useState } from 'react';
import { LoaderCircle, Upload, CheckCircle, XCircle, Music } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { parseBlob } from 'music-metadata';
import { useQueryClient } from '@tanstack/react-query';

import { ALBUM_KEYS, ARTIST_KEYS, SONG_KEYS } from '@/hook/query';
import { Progress } from '@/components/ui/progress';
import type { TablesUpdate } from '@/lib/database.types';
import {
  ALLOWED_AUDIO_TYPES,
  ALLOWED_COVER_TYPES,
  MAX_AUDIO_BYTES,
  MAX_COVER_BYTES,
  MAX_FILES_PER_JOB,
  TUS_CHUNK_SIZE,
} from '@/lib/storage';
import { uploadResumable } from '@/lib/tusUpload';
import { createClient } from '@/utils/supabase/client';

/**
 * Admin upload, driven entirely from the browser.
 *
 * The bytes go file input -> Supabase Storage over TUS, never through a Vercel
 * function: the request body limit there is ~4.5MB and the audio cap is 100MB,
 * so proxying was never actually viable. The server is involved exactly twice —
 * once to mint the job and the object paths, once to verify the object landed
 * and register the `songs` row.
 *
 * The admin check that used to gate this whole page happens one level up, in
 * `/admin/page.tsx` — this component assumes it is only ever mounted for an
 * admin. That check is for RENDERING ONLY regardless: both endpoints call
 * `requireAdmin()`, the Storage policies require a live ADMIN role, and
 * `songs_write_admin` re-checks it on the insert. Hiding the form is a
 * courtesy, not a control.
 */

const AUDIO_ACCEPT = ALLOWED_AUDIO_TYPES.join(',');
const COVER_TYPES: readonly string[] = ALLOWED_COVER_TYPES;
const AUDIO_TYPES: readonly string[] = ALLOWED_AUDIO_TYPES;

// Matches the server's zod bounds, so a file with an enormous tag is truncated
// here instead of failing the whole item with a 400 at the very end.
const NAME_MAX = 200;
const PERSON_MAX = 120;

type SongMetadata = {
  title: string;
  artist: string[];
  composers: string[];
  album: string | null;
  genre: string | null;
  duration: number;
};

type Cover = { blob: Blob; contentType: string };

type ItemStatus = 'queued' | 'reading' | 'uploading' | 'finishing' | 'done' | 'failed';

type Item = {
  file: File;
  status: ItemStatus;
  progress: number;
  error?: string;
};

type JobResponse = {
  jobId: string;
  audioBucket: string;
  coverBucket: string;
  items: Array<{
    id: string;
    originalName: string;
    audioPath: string;
    coverPath: string | null;
  }>;
};

const trim = (value: string, max: number) => value.trim().slice(0, max);

const stripExtension = (name: string) => name.replace(/\.[^./\\]+$/, '') || name;

/**
 * Some MP3 sources bake literal HTML entities into the filename or the ID3
 * tags themselves — e.g. a title of `Narak (From &quot;Ishqnama&quot;)` — which
 * is where those sites' own scraping/tagging tools failed to decode a page
 * title before writing it. Decoding via a detached `<textarea>` is the
 * standard safe trick: parsing happens off-DOM, so nothing executes even if
 * the string contained markup.
 */
function decodeHtmlEntities(value: string): string {
  if (typeof document === 'undefined') return value;
  const el = document.createElement('textarea');
  el.innerHTML = value;
  return el.value;
}

/**
 * ID3 stores a list of people as one free-text field, and taggers overwhelmingly
 * comma-separate it — `"Shakira, Burna Boy"` is two artists, not one whose name
 * contains a comma. Left unsplit it becomes a single artist for the whole of the
 * app: its own card in the artists rail, its own `/artist/...` page, and a song
 * that never appears under either real performer.
 *
 * Splitting here is CONSISTENCY, not a new policy: the admin edit dialog
 * (`parseList` in ManageSongsPanel) has always split this field on commas, so
 * until now the same value meant two different things depending on whether it
 * arrived by upload or by hand.
 *
 * The known false positive is a name that genuinely contains a comma — "Tyler,
 * The Creator", "Earth, Wind & Fire" — which lands as two artists. That is
 * accepted deliberately: it is far rarer than the multi-artist case, it is
 * visible immediately in the artists list, and it is repairable in the edit
 * dialog. There is no reliable way to tell the two apart from the tag alone.
 *
 * Only commas. Not `;` or `/` or `&`, which the edit dialog does not split
 * either — one delimiter, one meaning, both directions.
 */
function toStringArray(value: unknown, max: number): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    .flatMap(entry => entry.split(','))
    .map(entry => trim(decodeHtmlEntities(entry), PERSON_MAX))
    // A trailing or doubled comma ("A, B,") would otherwise contribute an empty
    // performer, which the server's `min(1)` per element would then reject.
    .filter(entry => entry !== '')
    .slice(0, max);
}

/**
 * ID3 tags, read in the browser.
 *
 * This used to be `parseBuffer` on the server, over a buffer the function itself
 * had received. It is `parseBlob` here, which means the result is now client
 * input in the strict sense — the server re-validates every field of it with zod
 * before any of it reaches the database.
 *
 * A file with unreadable tags is still a valid upload: it falls back to the
 * filename rather than failing.
 */
async function readMetadata(file: File): Promise<{ metadata: SongMetadata; cover: Cover | null }> {
  const fallback: SongMetadata = {
    title: decodeHtmlEntities(trim(stripExtension(file.name), NAME_MAX)),
    artist: [],
    composers: [],
    album: null,
    genre: null,
    duration: 0,
  };

  try {
    const parsed = await parseBlob(file);
    const { title, artist, artists, album, composer, genre, picture } = parsed.common;

    const metadata: SongMetadata = {
      title: title ? decodeHtmlEntities(trim(title, NAME_MAX)) : fallback.title,
      artist: toStringArray(artists ?? artist, 10),
      composers: toStringArray(composer, 20),
      album: album ? decodeHtmlEntities(trim(album, NAME_MAX)) : null,
      genre: genre?.[0] ? decodeHtmlEntities(trim(genre[0], 100)) : null,
      duration: Math.max(0, Math.round(parsed.format.duration ?? 0)),
    };

    const embedded = picture?.[0];
    let cover: Cover | null = null;

    if (embedded && COVER_TYPES.includes(embedded.format)) {
      // Uint8Array over a plain ArrayBuffer, which is what BlobPart wants.
      const blob = new Blob([new Uint8Array(embedded.data)], { type: embedded.format });
      if (blob.size > 0 && blob.size <= MAX_COVER_BYTES) {
        cover = { blob, contentType: embedded.format };
      }
    }

    return { metadata, cover };
  } catch {
    return { metadata: fallback, cover: null };
  }
}

export default function UploadSongsPanel() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Item[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const patchItem = (index: number, patch: Partial<Item>) =>
    setItems(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);

    const accepted = picked.filter(file => {
      if (!AUDIO_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" is not a supported audio file.`);
        return false;
      }
      if (file.size > MAX_AUDIO_BYTES) {
        toast.error(`"${file.name}" is larger than 100MB.`);
        return false;
      }
      return true;
    });

    if (accepted.length > MAX_FILES_PER_JOB) {
      toast.error(`Maximum ${MAX_FILES_PER_JOB} files allowed per upload.`);
      event.target.value = '';
      setItems([]);
      return;
    }

    setItems(accepted.map(file => ({ file, status: 'queued', progress: 0 })));
  };

  const handleUpload = async () => {
    if (items.length === 0) {
      toast.error('Please select at least one song file.');
      return;
    }

    setUploading(true);
    const supabase = createClient();

    /**
     * Progress and session bookkeeping goes straight to the table from here.
     * That is not an identity shortcut: the row is reachable only through
     * `upload_job_items_owner_all`, which derives the owner from the caller's
     * JWT. Nothing in the update names a user.
     */
    const record = async (itemId: string, patch: TablesUpdate<'upload_job_items'>) => {
      const { error } = await supabase.from('upload_job_items').update(patch).eq('id', itemId);
      if (error) console.error('Failed to record upload state:', error);
    };

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }

      setItems(prev => prev.map(item => ({ ...item, status: 'reading', progress: 0 })));
      const parsed = await Promise.all(items.map(item => readMetadata(item.file)));

      const { data: created } = await axios.post('/api/upload-song', {
        items: items.map((item, index) => ({
          originalName: item.file.name,
          size: item.file.size,
          contentType: item.file.type,
          coverContentType: parsed[index].cover?.contentType,
        })),
      });

      // `job.items` comes back in manifest order, which is what lets this pair
      // each local file with its server-minted paths by index. Matching on the
      // filename would break on two files of the same name.
      const job = created.data as JobResponse;
      let succeeded = 0;

      for (let index = 0; index < items.length; index++) {
        const { file } = items[index];
        const jobItem = job.items[index];
        const { metadata, cover } = parsed[index];

        let coverUploaded = false;
        let completeAttempted = false;

        patchItem(index, { status: 'uploading', progress: 0, error: undefined });

        try {
          let recorded = 0;
          let shown = -1;

          // Re-read the session per file rather than reusing the one fetched
          // before the batch. A ten-file batch can easily outrun the one-hour
          // access token, and tus would then 401 with no way to recover; this
          // narrows the stale-token window to a single file. (A single file
          // slow enough to outlast a token still fails — see the report.)
          const { data: current } = await supabase.auth.getSession();
          const accessToken = current.session?.access_token ?? session.access_token;

          await uploadResumable({
            file,
            bucket: job.audioBucket,
            objectPath: jobItem.audioPath,
            contentType: file.type,
            accessToken,
            onSessionUrl: url =>
              void record(jobItem.id, {
                upload_session_id: url,
                status: 'SIGNED',
                signed_at: new Date().toISOString(),
              }),
            onProgress: (sent, total) => {
              // tus reports progress on every XHR tick. Re-rendering the list
              // that often is pure jank, so only whole percentage points move.
              const percent = Math.round((sent / total) * 100);
              if (percent !== shown) {
                shown = percent;
                patchItem(index, { progress: percent });
              }
              // One write per chunk, not per progress event — otherwise a 100MB
              // file would issue thousands of PostgREST requests.
              if (sent - recorded >= TUS_CHUNK_SIZE) {
                recorded = sent;
                void record(jobItem.id, { uploaded_bytes: sent });
              }
            },
          });

          // Cover art goes AFTER the audio on purpose. Uploading it first would
          // leave an orphaned image in `song-covers` every time the (much
          // larger, much likelier to fail) audio upload died.
          if (cover && jobItem.coverPath) {
            const { error } = await supabase.storage
              .from(job.coverBucket)
              .upload(jobItem.coverPath, cover.blob, {
                contentType: cover.contentType,
                upsert: true,
              });

            if (error) console.error('Cover upload failed; continuing without it:', error);
            else coverUploaded = true;
          }

          await record(jobItem.id, { status: 'UPLOADED', uploaded_bytes: file.size });

          patchItem(index, { status: 'finishing', progress: 100 });

          completeAttempted = true;
          await axios.post('/api/upload-song/complete', {
            jobId: job.jobId,
            itemId: jobItem.id,
            metadata,
          });

          patchItem(index, { status: 'done' });
          succeeded++;
        } catch (error) {
          const message = axios.isAxiosError(error)
            ? error.response?.data?.message || 'Upload failed'
            : error instanceof Error
              ? error.message
              : 'Upload failed';

          patchItem(index, { status: 'failed', error: message });

          // Orphan cleanup. Objects with no `songs` row pointing at them are
          // dead weight nothing will ever look at again, so remove them —
          // UNLESS the completion call was already attempted. A failure there
          // may only be a lost response over a song that really was created,
          // and deleting the audio out from under a live row is far worse than
          // leaving a file behind. Those are recorded on the job for the
          // expiry sweep instead.
          if (!completeAttempted) {
            await supabase.storage.from(job.audioBucket).remove([jobItem.audioPath]);
            if (coverUploaded && jobItem.coverPath) {
              await supabase.storage.from(job.coverBucket).remove([jobItem.coverPath]);
            }
          }

          await record(jobItem.id, {
            status: 'FAILED',
            error_code: completeAttempted ? 'COMPLETION_FAILED' : 'CLIENT_UPLOAD_FAILED',
          });
        }
      }

      const failed = items.length - succeeded;

      if (failed === 0) toast.success(`All ${succeeded} songs uploaded.`);
      else if (succeeded > 0) toast.error(`Uploaded ${succeeded}. ${failed} failed.`);
      else toast.error('All uploads failed.');

      if (succeeded > 0) {
        queryClient.invalidateQueries({ queryKey: SONG_KEYS.all });
        // Uploading is the third writer of `songs.artist`, alongside the delete
        // and retag mutations in `useAdminQueries`. The artist list is derived
        // from that column, so a track by a brand-new artist creates an artist —
        // and without this the Artists tab never lists them, which means they can
        // never be given a photo. `refetchType: 'all'` because that tab is
        // unmounted right now; see the note on ARTIST_KEYS.
        queryClient.invalidateQueries({ queryKey: ARTIST_KEYS.all, refetchType: 'all' });
        queryClient.invalidateQueries({ queryKey: ALBUM_KEYS.all, refetchType: 'all' });
      }

      // A song that finished belongs in the catalogue, not in this list —
      // leaving it here read as "still pending" and the button re-offered to
      // upload it again. Failed items stay so the error is visible and the
      // file doesn't have to be re-picked to see what went wrong.
      setItems(prev => prev.filter(item => item.status !== 'done'));
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.message || 'Server error'
        : 'Something went wrong';
      toast.error(message);
      setItems(prev =>
        prev.map(item => (item.status === 'done' ? item : { ...item, status: 'failed' }))
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center px-6 py-8">
      <div className="w-full min-w-[330px] max-w-md bg-surface-elevated/80 rounded-lg shadow">
        <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
          <h2 className="text-xl text-center font-bold leading-tight tracking-tight md:text-2xl text-foreground">
            Upload Songs
          </h2>

          <div className="space-y-4 md:space-y-6">
            <div>
              <label
                htmlFor="song-files"
                className="block mb-2 text-sm font-medium text-foreground"
              >
                Select audio files (max {MAX_FILES_PER_JOB}, up to 100MB each)
              </label>
              <input
                ref={fileInputRef}
                id="song-files"
                type="file"
                multiple
                accept={AUDIO_ACCEPT}
                onChange={handleFileChange}
                disabled={uploading}
                className="text-sm font-light rounded-lg block w-full p-2.5 bg-secondary border-border text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {items.length > 0 && (
              <ul className="space-y-3 max-h-72 overflow-y-auto">
                {items.map((item, index) => (
                  <li key={`${item.file.name}-${index}`} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 min-w-0 text-foreground/80">
                        {item.status === 'done' ? (
                          <CheckCircle
                            aria-hidden="true"
                            className="w-3.5 h-3.5 shrink-0 text-primary"
                          />
                        ) : item.status === 'failed' ? (
                          <XCircle
                            aria-hidden="true"
                            className="w-3.5 h-3.5 shrink-0 text-destructive"
                          />
                        ) : (
                          <Music aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span className="truncate">{decodeHtmlEntities(item.file.name)}</span>
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {item.status === 'reading'
                          ? 'Reading tags'
                          : item.status === 'uploading'
                            ? `${item.progress}%`
                            : item.status === 'finishing'
                              ? 'Finishing'
                              : item.status === 'done'
                                ? 'Done'
                                : item.status === 'failed'
                                  ? 'Failed'
                                  : `${Math.round(item.file.size / 1024 / 1024)}MB`}
                      </span>
                    </div>

                    {(item.status === 'uploading' || item.status === 'finishing') && (
                      <Progress
                        value={item.progress}
                        aria-label={`Upload progress for ${item.file.name}`}
                        className="h-1.5 bg-muted-foreground/30 [&_[data-slot=progress-indicator]]:bg-brand"
                      />
                    )}

                    {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={handleUpload}
              disabled={uploading || items.length === 0}
              className="w-full text-primary-foreground bg-primary hover:bg-primary/90 focus:ring-1 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <span className="flex items-center justify-center gap-4">
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                  Uploading...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Upload aria-hidden="true" className="w-4 h-4" />
                  Upload{' '}
                  {items.length ? `${items.length} Song${items.length > 1 ? 's' : ''}` : 'Songs'}
                </span>
              )}
            </button>

            <p className="text-xs text-muted-foreground text-center">
              Files upload straight from this browser to storage. Keep this tab open until every
              track reports Done.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
