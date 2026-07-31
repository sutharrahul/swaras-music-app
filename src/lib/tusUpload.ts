'use client';

/**
 * Browser-side resumable (TUS) upload to Supabase Storage.
 *
 * Browser-only by construction: it takes a `File` and drives XHR, so it must
 * never be imported from a route handler. It also never sees a secret — the
 * bearer token is the caller's own access token, and `song_audio_insert_admin`
 * is what actually decides whether the write lands. A signed-in non-admin
 * holding a valid token gets a 403 from Storage itself.
 */

import * as tus from 'tus-js-client';

import { TUS_CHUNK_SIZE, resumableUploadEndpoint } from '@/lib/storage';

export type ResumableUploadArgs = {
  file: File;
  bucket: string;
  objectPath: string;
  contentType: string;
  accessToken: string;
  /**
   * A previously stored `upload_job_items.upload_session_id`. Given one, tus
   * HEADs it to learn the server-side offset and continues from there instead of
   * restarting — which is the entire reason the column exists.
   */
  uploadUrl?: string | null;
  /** Fired once the session URL exists, so it can be persisted for a retry. */
  onSessionUrl?: (url: string) => void;
  onProgress?: (bytesSent: number, bytesTotal: number) => void;
};

export function uploadResumable({
  file,
  bucket,
  objectPath,
  contentType,
  accessToken,
  uploadUrl,
  onSessionUrl,
  onProgress,
}: ResumableUploadArgs): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: resumableUploadEndpoint(),
      uploadUrl: uploadUrl ?? undefined,
      // Storage rejects anything but exactly 6MB for every chunk but the last.
      chunkSize: TUS_CHUNK_SIZE,
      retryDelays: [0, 3000, 6000, 12000, 24000],
      // Storage requires the creation request to carry data; without this the
      // upload is created and then immediately 4xxs on the first PATCH.
      uploadDataDuringCreation: true,
      // Keep the fingerprint so a retry in this page session resumes. It is
      // cleared on success so a genuinely new upload of the same file does not
      // latch onto a finished session.
      storeFingerprintForResuming: true,
      removeFingerprintOnSuccess: true,
      headers: {
        authorization: `Bearer ${accessToken}`,
        // A resumed or retried upload rewrites an object that already exists.
        // Without this Storage 409s on the second attempt.
        'x-upsert': 'true',
      },
      metadata: {
        bucketName: bucket,
        objectName: objectPath,
        contentType,
        cacheControl: '3600',
      },
      onUploadUrlAvailable: () => {
        if (upload.url) onSessionUrl?.(upload.url);
      },
      onProgress: (sent, total) => onProgress?.(sent, total),
      onSuccess: () => resolve(),
      // The message is shown to an admin operating the page, and Storage's
      // errors here are operational (403, 413, network) rather than sensitive.
      onError: error => reject(error),
    });

    upload.start();
  });
}
