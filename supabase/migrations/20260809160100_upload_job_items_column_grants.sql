-- ---------------------------------------------------------------------------
-- upload_job_items: narrow the browser's UPDATE to the columns it actually
-- writes.
--
-- THE BUG THIS FIXES
-- ------------------
-- 20260809130100_rls.sql granted table-wide `update` on `upload_job_items` to
-- `authenticated`, and the admin upload page writes that table straight from the
-- browser (progress and tus session bookkeeping). RLS restricts which ROWS —
-- your own job, and only while you are ADMIN — but RLS cannot restrict COLUMNS.
-- So an admin could PATCH `audio_path` on one of their own items to point at
-- another job's object; `/api/upload-song/complete` reads that column back and
-- registers a `songs` row for an object they never uploaded. The file's stated
-- invariant — "the paths are never taken from the request, they are read back
-- out of `upload_job_items` where this server wrote them" — was therefore false:
-- the client could rewrite what the server wrote.
--
-- Column privileges, not a policy, are what fix it. This is the same technique
-- already used on `public.users` (only "firstName"/"lastName"/profile_image_url
-- are grantable, which is what stops self-promotion to ADMIN).
--
-- WHAT EACH GRANTED COLUMN IS FOR
--   upload_session_id, signed_at  the tus resumable URL, so a retry resumes
--   uploaded_bytes                progress, one write per 6MB chunk
--   status, error_code            item state machine + machine-readable code
--   song_id, completed_at         written by /api/upload-song/complete, which
--                                 runs as the CALLER (publishable key + their
--                                 JWT), so it needs the same grant the browser
--                                 has. Neither column is trusted by anything.
-- Everything else — audio_path, cover_path, asset_prefix, total_bytes,
-- chunk_size, job_id, original_name — is server-written and now read-only to the
-- client, which is what makes the completion route's re-read meaningful.
--
-- DELETE is dropped: nothing deletes an item. Cleanup happens by deleting the
-- parent `upload_jobs` row, and that FK cascade runs inside the database, where
-- these grants do not apply.
--
-- INSERT IS DELIBERATELY KEPT, AND IS A KNOWN RESIDUAL
-- ----------------------------------------------------
-- `POST /api/upload-song` inserts the item rows through the caller's own client,
-- so `authenticated` genuinely needs INSERT; the browser never inserts. But
-- Postgres cannot tell those two apart — they are the same role and the same
-- JWT. An admin can therefore still INSERT an item row of their own with an
-- arbitrary `audio_path` into a job they own and complete it, reaching the same
-- outcome as the UPDATE above. Closing that means moving the server's insert off
-- the caller's JWT onto the secret key (as `src/lib/storage.server.ts` does for
-- signing) and revoking INSERT here. Not done: it is reachable only by a live
-- ADMIN, who can already upload and delete anything in the catalogue, so it is
-- an integrity nit inside a trusted role rather than a privilege boundary. Do
-- not describe this table as tamper-proof until that is done.
-- ---------------------------------------------------------------------------

revoke update, delete on public.upload_job_items from authenticated;

grant update (
  upload_session_id,
  uploaded_bytes,
  status,
  error_code,
  signed_at,
  song_id,
  completed_at
) on public.upload_job_items to authenticated;

-- select + insert are unchanged and still needed (the completion route reads the
-- row back; the job-creation route writes it).
