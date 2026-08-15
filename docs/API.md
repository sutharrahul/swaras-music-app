# API reference

Every HTTP endpoint in Swaras, read off the handlers themselves. Back to [the README](../README.md); for _why_ the API is shaped this way see [ARCHITECTURE.md](./ARCHITECTURE.md), and for environment and region setup see [DEPLOYMENT.md](./DEPLOYMENT.md).

There are 20 route handlers under `src/app/api/**`, plus one handler outside it at `/auth/callback`. There is no separate API service — these are Next.js Route Handlers running as Vercel functions in `bom1`.

## Rules that apply to every handler

**The caller is derived from the verified session.** `requireUser()`, `requireAdmin()` and `optionalUser()` in `src/lib/auth.ts` are the only way a handler learns who is calling. No endpoint accepts a user id in a body, a query param or a header — several used to, and those were the four IDOR bugs. `getUser()` is used rather than `getSession()`, so the access token is revalidated with the auth server rather than decoded from a cookie, and the role is re-read from `public.users.role` on every request rather than taken from a JWT claim.

**Deny by default, before the handler.** `src/middleware.ts` matches the path against an explicit `PUBLIC_ROUTES` list. An anonymous request to anything unlisted gets a 401 without the handler running at all. `/api/admin/*` is deliberately absent from that list, so `requireAdmin()` is the second gate, not the first. RLS in Postgres is the third.

**Response envelope.** Success is `{ success: true, message, data }`; `data` is omitted entirely when a handler passes null. Errors are `{ success: false, message }` with no `data` key. A 500 always carries a fixed message — the underlying `PostgrestError` is logged server-side and never echoed, because it can carry column names, constraint names and row values.

**Pagination.** Paginated endpoints take `?page=&limit=` and return

```json
"pagination": { "page": 1, "limit": 20, "total": 137, "hasMore": true }
```

`page` defaults to 1, `limit` defaults to 20 and is clamped to 100 by the shared zod schema in `src/lib/api.ts` — not per handler, so it cannot be forgotten in one of them. Junk (`?limit=abc`, `?page=0`, `?limit=999999`) is a 400 with the offending field named, never a silent `NaN` and never a full-table dump.

**Caching.** Anything carrying an expiring signed audio URL or per-user rows sets `Cache-Control: private, no-store`. `/api/artists` and `/api/albums` deliberately do _not_ — those responses are byte-identical for every caller and their image URLs are permanent public-bucket URLs. Mutation responses (POST/PATCH/DELETE) that happen to include a signed `audioUrl`, such as `/api/admin/update-song`, do not set the header; responses to non-GET methods are not stored by shared caches to begin with.

**Common failures.** `respondToDbError` maps Postgres/PostgREST codes to statuses, so these are consistent across every handler:

| Situation                             | Status | Message                                  |
| ------------------------------------- | ------ | ---------------------------------------- |
| Anonymous caller on a protected route | 401    | `Unauthorized: please sign in`           |
| Session with no `public.users` row    | 403    | `Forbidden: this account has no profile` |
| Account `status != 'ACTIVE'`          | 403    | `Forbidden: this account is not active`  |
| Signed in, not an admin               | 403    | `Forbidden: admin access required`       |
| Malformed JSON body                   | 400    | `Invalid JSON body`                      |
| Failed zod validation                 | 400    | `<field>: <reason>`                      |
| Unique violation (`23505`)            | 409    | `That record already exists`             |
| FK violation (`23503`)                | 404    | `Referenced record does not exist`       |
| Check constraint (`23514`)            | 400    | `Invalid value for one of the fields`    |
| RLS refusal (`42501`)                 | 403    | `Forbidden`                              |
| Anything else                         | 500    | fixed per-handler string                 |

**The song shape.** Every endpoint that returns songs returns the same DTO, mapped from snake_case rows in `src/lib/dto.ts`:

```json
{
  "id": "…",
  "title": "…",
  "duration": 214,
  "audioUrl": "https://…/object/sign/song-audio/…",
  "artist": ["…"],
  "composers": ["…"],
  "album": null,
  "movie": null,
  "genre": null,
  "coverUrl": "https://…/object/public/song-covers/…",
  "lyrics": null,
  "createdAt": "…",
  "updatedAt": "…",
  "_count": { "likes": 3 }
}
```

`uploaded_by_user_id` and any join onto `users` are absent by construction — `SONG_COLUMNS` is an explicit list, never `select('*')`. `audioUrl` is signed for anonymous callers too (listening is public) and is null only when signing genuinely failed. `coverUrl` is a plain public-bucket URL with no expiry.

---

## Songs & search

| Method | Path             | Auth                         | Purpose                                                      |
| ------ | ---------------- | ---------------------------- | ------------------------------------------------------------ |
| GET    | `/api/get-songs` | public                       | The paginated catalogue, with signed playback URLs           |
| GET    | `/api/search`    | public (more when signed in) | Songs by title/album/artist, plus the caller's own playlists |

### GET `/api/get-songs`

Query: `page`, `limit`, and optionally one of `artist`, `album`, `movie`. Nothing stops combining the three — PostgREST just ANDs them.

`artist` filters against `songs.artist text[]` with a manually quoted PostgREST array literal rather than `.contains()`, because `.contains()` emits an unquoted `{a,b}` literal and a comma _inside_ one artist name (this catalogue has one) would be read as a second array element and silently return zero rows. Backslashes are escaped before quotes.

Response `data`: `{ songs: SongDto[], pagination }`, ordered `created_at` descending. Sent `private, no-store`.

The signing happens once for the whole page — one `createSignedUrls` call in `toSongDtos`, never one per track — and like counts come from the `song_like_counts` SECURITY DEFINER function, because an embedded `likes(count)` would be filtered by the owner-only RLS policy and render 0 for everyone but the liker.

### GET `/api/search`

Query: `q`, required, trimmed, 1–100 characters. Not paginated — a fixed 10 songs and 10 playlists.

`q` is **sanitized, not escaped**: `,` `(` `)` `"` `'` `\` `%` `*` `{` `}` are replaced with spaces. PostgREST's `or=` takes a filter _expression_ as a string, so a comma ends a condition and a parenthesis closes a group — an unescaped term is a filter-injection surface. Quoting rules differ between the `ilike` and `cs` operators, so structural characters are stripped rather than quoted, and `%`/`*` go too so nobody can turn a search box into a full-table `ilike '%%'` scan. A term that sanitizes down to nothing returns 200 with two empty arrays.

Response `data`: `{ songs: [{ id, title, artist, album, coverUrl }], playlists: [{ id, name, description }] }`. The playlist half is skipped entirely for an anonymous caller — `optionalUser()` returns `user: null` and nothing reads an id from the request either way. This is the one endpoint where `private, no-store` is a security control rather than a performance note: the response mixes public catalogue with one user's playlist names.

---

## Artists & albums

Both directories are **derived at query time**, not stored. `artist_song_counts()` unnests `songs.artist text[]`; `album_song_counts()` aggregates `songs.album`. `public.artists` is a profile side-table keyed by name with no FK to anything — an artist with no row there is the normal case.

| Method | Path                   | Auth   | Purpose                                                   |
| ------ | ---------------------- | ------ | --------------------------------------------------------- |
| GET    | `/api/artists`         | public | Artist directory with song counts and photos, paginated   |
| GET    | `/api/artists/profile` | public | One artist's bio and photo, by `?name=`                   |
| GET    | `/api/albums`          | public | Album directory with song counts and cover art, paginated |

### GET `/api/artists`

Query: `page`, `limit`. Response `data`: `{ artists: [{ name, songCount, imageUrl }], pagination }`, ordered by song count descending then name ascending.

The ordering is stated twice — inside the SQL function and again as `.order()` calls on the RPC. That is not redundancy: PostgREST paginates a set-returning function by wrapping it in an outer select with LIMIT/OFFSET, and Postgres does not promise a sort inside a subquery survives the wrapper. Without the outer sort, pages reshuffle and `range()` produces duplicates and gaps.

Photos are fetched in one extra round-trip for the whole page (`artistImagePaths`) and fail soft: a Storage or table error yields an empty map and placeholder glyphs rather than a failed listing. `songCount` is a `bigint` coerced with `Number()`, since PostgREST returns large bigints as JSON strings.

No `private, no-store` here, deliberately — see the caching rule above.

### GET `/api/artists/profile`

Query: `name`, required, trimmed, 1–200 characters.

**The name is a query param, not a path segment.** `AC/DC` is a real artist name, and `/api/artists/AC%2FDC` depends on an encoded slash surviving Next's path normalisation, which it does not do reliably. A query param is decoded exactly once by `URL`, with no path semantics attached.

**A missing row is 200 with `imageUrl: null`, never 404.** An artist exists because a song names them; having no profile row means "no photo yet", not "no such artist". A 404 would make TanStack Query mark the query failed and paint an error state over an artist page that is working perfectly — songs listed, playback fine — because a photo is absent.

Response `data`: `{ artist: { name, bio, imageUrl } }`. `name` is echoed from the validated query, not from the row, because there may be no row. `bio` is null both for an artist with no row and for one whose row has no bio; the page renders nothing either way and does not need to tell them apart.

### GET `/api/albums`

Query: `page`, `limit`. Response `data`: `{ albums: [{ name, songCount, coverUrl }], pagination }`. Built the same way as `/api/artists`, including the doubled ordering, minus the second query for artwork — an album's cover is one of its own songs' covers, which the aggregate already returns, so there is nothing to merge and nothing that can drift. Songs with a null or blank album are filtered out by the aggregate rather than collecting in an "Unknown" bucket.

---

## Playlists

Every playlist route filters by the session user _and_ sits under `playlists_owner_all` / `playlist_songs_owner_all`. A playlist belonging to someone else returns **404, not 403** — an earlier version fetched the row and then answered 403, which confirmed to the caller that the id existed and made an enumeration oracle over other people's playlists. "Not found" is the honest answer to "a playlist you can see with this id".

| Method | Path                          | Auth      | Purpose                                 |
| ------ | ----------------------------- | --------- | --------------------------------------- |
| GET    | `/api/playlists`              | signed-in | The caller's playlists with song counts |
| POST   | `/api/playlists`              | signed-in | Create a playlist                       |
| GET    | `/api/playlists/[playlistId]` | signed-in | One playlist and its songs              |
| DELETE | `/api/playlists/[playlistId]` | signed-in | Delete a playlist                       |
| POST   | `/api/post-playlist`          | signed-in | Add a song to a playlist                |
| DELETE | `/api/remove-playlist-song`   | signed-in | Remove a song from a playlist           |
| DELETE | `/api/delete-playlist`        | signed-in | Body-based delete; the older spelling   |

### GET `/api/playlists`

No query params, no pagination — the caller's full list, ordered `created_at` descending. Response `data` is a **bare array**, not an object:

```json
[
  {
    "id": "…",
    "name": "…",
    "description": null,
    "createdAt": "…",
    "updatedAt": "…",
    "_count": { "playlistSongs": 12 }
  }
]
```

The count uses a real PostgREST `playlist_songs(count)` aggregate rather than the SECURITY DEFINER trick used for like counts, and that is correct here: a playlist's song count is visible to exactly the person who can already see the playlist. Sent `private, no-store`.

### POST `/api/playlists`

Body: `{ name }` (trimmed, 1–120) and optional `description` (trimmed, ≤500, nullable). `user_id` is not in the schema, so a client that sends one has it dropped by zod before the insert rather than overriding the session. An empty-string description is normalised to null. Returns **201** with the same summary DTO, `_count.playlistSongs` 0.

### GET `/api/playlists/[playlistId]`

Response `data`:

```json
{ "id": "…", "name": "…", "description": null,
  "createdAt": "…", "updatedAt": "…",
  "playlistSongs": [{ "id": "…", "addedAt": "…", "song": { …SongDto } }] }
```

Sorted by `addedAt` descending **in memory** — PostgREST cannot order an embedded resource by a parent-side expression, and one playlist's worth of rows is a safe size to sort in the handler. Sent `private, no-store` (signed audio URLs). 404 if the id is not the caller's.

### DELETE `/api/playlists/[playlistId]`

Deletes straight through the ownership filter in one round-trip rather than read-then-delete, closing the gap between the two; `.select('id')` reports whether the filter matched, which is how 404 is distinguished from success. Returns `data: { id }`.

### POST `/api/post-playlist`

Body: `{ playlistId, songId }`, both non-empty strings. Ownership is checked as `user_id = session user` — never a value from the body — and `playlist_songs_owner_all` re-checks on insert.

`position` is append-at-the-end, computed read-then-write, so two concurrent adds can land on the same position. That is cosmetic: the UI orders by `added_at` and there is no unique index on `position`.

Returns **201**, `data: { id, playlistId, songId, position, addedAt }`. A song already in the playlist is a **409** (the `(playlist_id, song_id)` unique index); a `songId` that does not exist is a **404** (the FK). Both used to be 500s.

### DELETE `/api/remove-playlist-song`

Body: `{ playlistId, songId }`. 404 for a playlist that is not the caller's, and 404 `Song not found in playlist` when the delete matches nothing. Returns `data: { playlistId, songId }`.

### DELETE `/api/delete-playlist`

Body: `{ playlistId }`. Functionally identical to `DELETE /api/playlists/[playlistId]`, kept because `usePlaylistApi.deletePlaylist` still calls it; collapsing the two is frontend consolidation work, not an auth concern. Returns `data: { id }`.

---

## Likes

| Method | Path                   | Auth      | Purpose                             |
| ------ | ---------------------- | --------- | ----------------------------------- |
| POST   | `/api/like-song`       | signed-in | Like a song                         |
| DELETE | `/api/like-song`       | signed-in | Unlike a song                       |
| GET    | `/api/get-liked-songs` | signed-in | The caller's liked songs, paginated |

Both `like-song` methods take `{ songId }` and nothing else. They previously took `{ userId, songId }` with no auth at all, which let anyone like or unlike as anyone else and enumerate which user ids existed while doing it; a `userId` sent by a stale client is now simply ignored, and `likes_owner_all` enforces the same rule underneath.

POST returns **201** `{ songId }`. A duplicate like is **409** and an unknown song is **404**, both from the constraint mapping rather than a 500. DELETE returns **200** `{ songId }`, or **404** `That song is not liked` when nothing was removed — the `.select('id')` on the delete is what distinguishes "unliked it" from "there was nothing to unlike".

`GET /api/get-liked-songs` takes `page` and `limit` and returns `{ songs: SongDto[], pagination }`, newest like first. One round-trip: the embedded `songs!inner` join follows the FK and `count: 'exact'` supplies the total. Sent `private, no-store`.

---

## Uploads

**No file bytes pass through any of these.** A Vercel request body caps near 4.5MB and a track can be 100MB, so the browser uploads straight to Supabase Storage over TUS in 6MB chunks between calls two and three. The endpoints broker paths and verify results.

| Method | Path                             | Auth                   | Purpose                                                |
| ------ | -------------------------------- | ---------------------- | ------------------------------------------------------ |
| POST   | `/api/upload-song`               | admin                  | Step 1 — mint a job and server-derived object paths    |
| POST   | `/api/upload-song/complete`      | admin                  | Step 3 — register the uploaded object as a `songs` row |
| POST   | `/api/upload-song/sweep-expired` | admin _or_ cron secret | Expire abandoned jobs and delete orphaned objects      |

### The three-step flow

1. **`POST /api/upload-song`** with a manifest of file names, sizes and content types. The response contains object paths the _server_ derived from ids it generated, recorded in `upload_job_items`.
2. **The browser uploads** each file to `${SUPABASE_URL}/storage/v1/upload/resumable` with `tus-js-client`, at exactly those paths, authorized by the admin's own access token against `song_audio_insert_admin`. Chunks must be exactly 6MB except the last — that is Supabase's requirement, not a tunable.
3. **`POST /api/upload-song/complete`** per item, with ids and browser-parsed ID3 metadata. The handler re-reads the paths from `upload_job_items` and verifies the stored object.

The path minting is the security boundary. A client-supplied path would let an admin write anywhere in the bucket and, worse, let step 3 register a song pointing at an object they never uploaded. `upload_job_items` rows are inserted with the secret key, not the caller's client, because `authenticated` has had its INSERT grant on that table revoked — under the same role and JWT, Postgres could not tell "the server inserting rows it derived" from "the browser inserting whatever it likes".

### POST `/api/upload-song`

Body:

```json
{
  "items": [
    {
      "originalName": "…",
      "size": 8123456,
      "contentType": "audio/mpeg",
      "coverContentType": "image/jpeg"
    }
  ]
}
```

1–10 items. `originalName` 1–255 chars, `size` a positive integer ≤ 104857600 (100MiB), `contentType` from the 12-value audio allow-list, `coverContentType` optional from the 4-value image allow-list. The manifest is untrusted input, so sizes are bounded here _as well as_ by the bucket's own `file_size_limit` — this check produces a useful 400 before a 100MB upload starts; the bucket limit is the one that cannot be bypassed. No cover size is accepted, because nothing would consume it.

Returns **201**:

```json
{
  "jobId": "…",
  "chunkSize": 6291456,
  "audioBucket": "song-audio",
  "coverBucket": "song-covers",
  "items": [
    {
      "id": "…",
      "originalName": "…",
      "audioPath": "songs/<jobId>/<itemId>/audio.mp3",
      "coverPath": "songs/<jobId>/<itemId>/cover.jpg"
    }
  ]
}
```

`items` stays in manifest order — the client pairs its own `File` objects with these by index. Paths never contain the uploaded filename; the original is kept in `upload_job_items.original_name` for display only. The job carries a 24-hour `expires_at`, which is what the sweep keys off. If the item insert fails the job row is rolled back, which is safe precisely because nothing has been uploaded yet.

### POST `/api/upload-song/complete`

Body: `{ jobId, itemId, metadata }` where `metadata` is `{ title (1–200), artist (≤10 names, ≤120 each), composers (≤20), album (≤200, nullable), genre (≤100, nullable), duration (integer 0–86400) }`. No `movie`, `lyrics` or cover fields — those are filled in later through `/api/admin/update-song`. An empty `artist` array becomes `['Unknown Artist']`.

Every bound exists because the ID3 tags are parsed in the _browser_ with `parseBlob`, so they are whatever the client decided to send, not something this process read off disk. Without the caps a crafted tag could write a megabyte of text into the catalogue or a thousand-element artist array the UI then tries to render.

Behaviour:

- The item is looked up by `(itemId, jobId)`; `upload_job_items_owner_all` means naming another admin's item returns nothing → **404**.
- Already has a `song_id` → **200** `{ songId }`. This is the idempotency guard: a double-click or a lost response must not insert the song twice, and there is no unique constraint that would catch it (two identical uploads are legitimately two rows).
- Missing `audio_path`, object absent from Storage, or object size ≠ the manifest's `total_bytes` → **409**, and the item is marked `FAILED` with a code (`AUDIO_PATH_MISSING`, `STORAGE_OBJECT_MISSING`, `STORAGE_OBJECT_SIZE_MISMATCH` — a code, never an exception message). Size is read with `list`, not `download`, so the file never comes back through the function.
- A declared cover that is absent degrades to no cover rather than failing the song.
- Success → **201** `{ songId, title }`. `uploaded_by_user_id` is the session user, and `songs_write_admin` re-checks ADMIN on the insert regardless.

The item is marked COMPLETE _after_ the song row exists. If that update fails the song is still valid and playable and the item is simply left un-marked; the opposite ordering can delete a track someone is already listening to. The job flips to COMPLETED once no item is still PENDING/SIGNED/UPLOADED — FAILED counts as settled, or one bad item would leave a job stuck at PROCESSING forever and un-sweepable.

### POST `/api/upload-song/sweep-expired`

Two ways in: `Authorization: Bearer $CRON_SECRET` matching a non-empty `CRON_SECRET`, **or** `requireAdmin()`. Vercel signs cron requests with that header automatically; nothing else needs to send it.

**No schedule is wired up.** Adding one is a `crons` entry in `vercel.json` plus the env var — set the env var _first_, or you ship a secret-key-backed endpoint whose shared secret is not actually configured. Until then this is a usable manual "run the sweep now" for any admin.

Marks PROCESSING jobs past `expires_at` as EXPIRED, removes Storage objects for items that never completed, and marks those items FAILED with `JOB_EXPIRED`. An item that is COMPLETED or has a `song_id` is skipped no matter how the parent job looks — those objects have a live `songs` row pointing at them. Returns `data: { jobsSwept, itemsFailed, objectsRemoved }`.

---

## Admin

All four are `requireAdmin()`, which reads `public.users.role` live on every request. They are also absent from the middleware's public list, so an anonymous caller is refused with a 401 before any handler code runs, and `songs_write_admin` / `artists_write_admin` / the `artist_images_*_admin` Storage policies re-check in the database. Three independent layers, each assuming the others can fail.

| Method | Path                        | Purpose                                   |
| ------ | --------------------------- | ----------------------------------------- |
| DELETE | `/api/admin/delete-song`    | Delete a song row and its Storage objects |
| PATCH  | `/api/admin/update-song`    | Edit song metadata                        |
| POST   | `/api/admin/artist-photo`   | Mint an artist photo upload path          |
| PATCH  | `/api/admin/artist-photo`   | Confirm the uploaded photo                |
| DELETE | `/api/admin/artist-photo`   | Clear an artist's photo                   |
| PATCH  | `/api/admin/artist-profile` | Set or clear an artist's bio              |

### DELETE `/api/admin/delete-song`

Body: `{ songId }`. A `userId` in the body is not read; the handler that _did_ read it, looked up that user and checked _their_ role, was the privilege-escalation bug.

**Objects first, row second.** There is no transaction spanning Postgres and Storage, so one half-state is unavoidable — this picks the recoverable one. Row-deleted-objects-left is orphaned bytes nothing references and nothing can find again, billed forever. Objects-deleted-row-left is one track that 404s on play, visible, and fixed by retrying the exact same request, because `remove()` on an absent object is a no-op. So if any object survives removal the request aborts with a **500** (`Failed to remove the song files; the song was not deleted`) and the song is left intact and consistent.

Returns `data: { id, title }`, or **404** for an unknown `songId`.

### PATCH `/api/admin/update-song`

Body is `.strict()` — an unrecognised key is a 400, not silently ignored. `songId` is required plus at least one of: `title` (1–200), `artist` (array, ≥1 non-empty name), `composers` (array), `album` / `movie` (≤200, nullable), `genre` (≤100, nullable), `lyrics` (≤20000, nullable). A field that is _omitted_ is left alone; a field sent as `null` is cleared. A body carrying only `songId` is a 400 rather than a no-op round-trip.

Returns `data: { song: SongDto }` — the full re-mapped song, signed `audioUrl` included — or **404** if no row matched.

### `/api/admin/artist-photo`

Two steps, for the same reason uploads are: **no image bytes pass through here.** The browser uploads to Storage between POST and PATCH, authorized by its own token against `artist_images_insert_admin`. A photo is small enough to have proxied, but proxying it would mean a second upload path to keep correct for no gain.

**POST** — body `{ name (1–200), contentType }`, strict. Find-or-creates the `artists` row with an upsert on `name` in a single statement: a select-then-insert would race two admins opening the dialog for the same unprofiled artist, and `artists_name_key` turns that race into an update of the same row instead of a 23505 for the loser. Returns **201** `{ artistId, photoId, bucket, path }`.

`photoId` is a fresh UUID per upload, never a fixed `photo.jpg`. A stable key replaced in place keeps its URL, and both the Supabase CDN and the `next/image` optimizer cache by URL — an admin would replace a photo and keep being shown the old one with no way to tell whether it worked.

**PATCH** — body `{ artistId, photoId, contentType }`, strict. Both ids must match `^[A-Za-z0-9_-]{1,64}$`. Deliberately not `.uuid()`: `artists.id` is `text` with a UUID-shaped default, but a row seeded by hand from the Dashboard need not be, and a format check would reject a perfectly good artist. What actually matters is that the value cannot contain `/` or `.` and so cannot walk out of its folder; `artistPhotoPath()` re-checks the same class as a last line of defence.

The path is re-derived from those ids with the same function POST used — never read out of the body. The object is verified to exist (**409** `The photo was not found in storage` if not), then the row is pointed at it, and only _then_ is the superseded object deleted, best-effort. Delete-first would remove the image still being served the moment the update fails to land. Returns `data: { artist: { name, imageUrl } }`, or **404** for an unknown `artistId`.

**DELETE** — body `{ name }`, strict. Keyed by name rather than id because that is what the caller has: the artist list is derived from `songs.artist` and carries no row id. Clears `image_path` first, removes the object second, for the same ordering reason. Idempotent — an artist with no photo is already in the requested state and gets a 200, which matters because the button can be double-clicked and two admins can be looking at the same list. **404** if there is no `artists` row for that name. Returns `data: { artist: { name, imageUrl: null } }`.

### PATCH `/api/admin/artist-profile`

Body `{ name (1–200), bio }`, strict; `bio` is a string ≤2000 or `null` to clear it. Empty strings are normalised to null so the page does not render an empty paragraph. Upsert on `name`, because an artist derived from `songs.artist` has no profile row until someone writes one, and the bio is often the first thing written. Returns `data: { artist: { name, bio, imageUrl } }`.

Separate from `artist-photo` rather than another method on it: that route exists to broker a Storage upload, and none of minting a path, confirming bytes or deleting a superseded object applies to a paragraph of text.

---

## Auth

| Method | Path               | Auth      | Purpose                                                  |
| ------ | ------------------ | --------- | -------------------------------------------------------- |
| GET    | `/api/check-admin` | signed-in | Whether the caller is an admin                           |
| GET    | `/auth/callback`   | public    | Complete a Supabase auth flow and set the session cookie |

### GET `/api/check-admin`

No parameters. Returns `data: { isAdmin, role }`, read live from `public.users.role`, sent `private, no-store`.

It deliberately does **not** return the internal `public.users.id`. It used to, and the frontend then posted that id to `/api/admin/delete-song`, which trusted it — leaking the id was half of the privilege-escalation chain. Nothing the client does needs that id any more.

This gates _rendering only_. Every admin endpoint re-checks with `requireAdmin()` and RLS checks again in the database.

### GET `/auth/callback`

The landing point for every emailed auth link and for OAuth returns. It lives outside `src/app/api` and is in the middleware's public list — it has to be reachable while signed out, and it authenticates by the code or token in the query string, not by a session. It is a Route Handler rather than a Server Component for one reason: only a Route Handler can write cookies.

Supabase hands a session back in three shapes and this route handles two of them:

- **`?code=`** — the PKCE exchange, via `exchangeCodeForSession`. The browser that _started_ the flow holds a `code_verifier` cookie and both halves are required. This is what `createBrowserClient` produces, since it defaults to PKCE.
- **`?token_hash=&type=`** — a one-time token, via `verifyOtp`. No verifier cookie is involved, so it works when the link is opened in a _different_ browser from the one that requested it. That is the common case for password recovery: the reset is requested on a laptop and the mail opened on a phone, or the link opens inside Gmail's in-app browser.
- **`#access_token=…`** — the legacy implicit flow, in the URL **fragment**. This route can never handle it. A fragment is never sent to the server: the browser strips everything from the `#` onward before issuing the request, so the handler receives no usable parameter at all and cannot even detect that a token was present. Links built from `admin/generate_link` without a PKCE challenge come back this way, which is exactly how a recovery link ends up at `/sign-in?error=missing_code`. The fixes are on the template side — keep the recovery template on `{{ .ConfirmationURL }}` with a PKCE-initiated request, or switch it to `{{ .TokenHash }}`.

`?next=` controls where the user lands afterwards and is restricted to a same-site absolute path (`^\/(?!\/)`), which rejects both absolute URLs and protocol-relative `//evil.com`, so a crafted link cannot bounce a freshly authenticated user to another origin. It defaults to `/`.

Every outcome is a redirect, never a JSON body:

| Outcome                                        | Redirect                         |
| ---------------------------------------------- | -------------------------------- |
| Code exchanged / token verified                | `${origin}${next}`               |
| Exchange or verification failed                | `/sign-in?error=exchange_failed` |
| Neither `code` nor `token_hash`+`type` present | `/sign-in?error=missing_code`    |

Failures log `error.message` only — never the request headers or the query string, since those carry the single-use credential.
