# Architecture

How Swaras is put together and why — the long-form companion to [the README](../README.md), which covers what it is in sixty seconds. Deployment specifics live in [DEPLOYMENT.md](./DEPLOYMENT.md); the endpoint reference is [API.md](./API.md).

---

## The shape of the thing

Swaras is **one Next.js 15 application that is also its own backend**. There is no API service, no worker, no gateway. 18 pages and 20 Route Handlers under `src/app/api/**` build into a single Vercel project pinned to `bom1` (Mumbai), sitting next to an `ap-south-1` Supabase project. Supabase supplies all three of the things a backend usually assembles separately: Postgres, identity, and the object store.

The data layer is `supabase-js` speaking HTTP to PostgREST. That sentence carries more weight than it looks like it does:

- **No ORM.** Handlers name their columns explicitly — `SONG_COLUMNS` in `src/lib/dto.ts` is a literal string of column names — and map rows to DTOs by hand. Nothing generates SQL at runtime and nothing implicitly joins. The explicit column list is also a security control: `select('*')` on `songs` would put `uploaded_by_user_id` back on a public endpoint, which was most of one of the IDOR bugs.
- **No `DATABASE_URL` at runtime.** The app reads exactly five environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, and the optional `CRON_SECRET`). Grep for `process.env` in `src/` and that is the whole list. There is no Postgres connection string anywhere in the running app.
- **No connection pool.** This is what makes serverless a reasonable place to put a backend at all. A pooled ORM in a function environment means every cold start opens connections against a fixed server-side limit, and scaling out is the thing that breaks you. PostgREST over HTTPS has no such ceiling: a burst of concurrent invocations is a burst of HTTP requests, which is a problem Supabase's edge already knows how to have.

The cost of that arrangement is latency multiplication. Every render and every handler is a chain of _sequential_ HTTPS round trips — to PostgREST, to Auth, to Storage. Two or three hops per request is normal. That is exactly why the functions are colocated with the database region; put them in `iad1` and each hop pays a transpacific crossing several times over. Region colocation is not a micro-optimisation for this stack, it is the entire performance story. See [DEPLOYMENT.md](./DEPLOYMENT.md).

**The type system does the work an ORM would have done.** `src/lib/database.types.ts` (~700 lines) is generated from the live schema by `npm run db:types`, and every client is instantiated as `SupabaseClient<Database>`. A query naming a column that does not exist is a type error, not a runtime 500 — `.select('id, movie')` against a schema without `songs.movie` fails `npm run type-check` and fails `next build`. This is the closest thing the project has to an integration test, and it is why the file must never be hand-edited and must be regenerated after every migration: a stale `database.types.ts` lets a build pass against a column that was dropped.

The pages themselves are mostly **client components** consuming those same Route Handlers through TanStack Query, not Server Components reading Postgres directly. `src/app/page.tsx`, `/songs`, `/artists`, `/albums`, `/liked`, `/playlist`, `/admin` and the `artist|album|movie/[name]` browse pages all carry `'use client'`. The API surface is therefore the _only_ data path, which has a pleasant side effect: there is one place where authorization has to be right, not two.

---

## Authorization, in three layers

Each layer assumes the other two can fail.

### 1. Middleware — deny by default

`src/middleware.ts` delegates to `updateSession()` in `src/utils/supabase/middleware.ts`, which does two things that must not be separated: it refreshes the Supabase auth cookies, **and** it matches the request path against an explicit public allow-list. The default branch is DENY.

Keeping those two jobs in one function is deliberate. The stock Supabase middleware only refreshes cookies and authorizes nothing; dropping it in as-is during the migration off Clerk would have silently converted every route that had relied on `auth.protect()` into an anonymous public endpoint, because a handler that forgets its own check would no longer be caught by anything upstream.

The public list is `/`, `/auth/callback`, `/api/get-songs`, `/api/search`, `/artists`, `/api/artists/**`, `/albums`, `/api/albums/**`, `/songs`, `/artist/*`, `/album/*`, `/movie/*`, `/forgot-password`, `/reset-password`. Anything unlisted requires a session: paths under `/api/` get a 401 JSON body, pages get a redirect to `/sign-in?next=…` carrying only the path and query, never an origin. `/sign-in` and `/sign-up` are a third category — reachable signed out, and redirected to `/` when a session already exists.

Two traps are called out in the source and worth repeating. The `/^\/artist\/.+$/` pattern requires the trailing slash, so it does _not_ cover `/artists` — hence the separate entries, without which the whole artist directory would have been signed-in-only. And `/api/admin/artist-photo` is deliberately absent from the list even though its sibling `/api/artists/**` is present, so an anonymous caller is refused at the middleware before `requireAdmin()` is ever reached.

**Roles are deliberately not checked here.** The role lives in `public.users.role`, which means a database round-trip on every matched request — including every static-ish page load — and the copy in the JWT would be stale anyway. Admin routes are gated at this layer on _authentication only_; ADMIN itself is decided in the handler and again by RLS.

### 2. Session-derived identity in every handler

`src/lib/auth.ts` exports `requireUser()`, `requireAdmin()` and `optionalUser()`. They are the only way a handler learns who the caller is, and they accept an id from no body, no query param and no header. Everything routes through one private `resolveActor()`:

1. `supabase.auth.getUser()` — not `getSession()`. `getUser()` revalidates the access token with the auth server; `getSession()` merely decodes whatever cookie the browser sent, which is not verification.
2. Look up `public.users` by `supabase_user_id`. Never by email (see below).
3. Reject unless `status = 'ACTIVE'`. The project deactivates users instead of deleting them, which only means something if deactivation actually revokes access; `current_app_user_id()` in SQL gates on the same condition, so this mirrors what RLS would do anyway.

The failure modes are distinct and all fail closed: `anonymous` → 401, `no-profile` → 403, `inactive` → 403, `error` → 500. `optionalUser()` collapses every one of them to `user: null`, so a handler serving anonymous callers cannot accidentally read "no profile" as "signed in".

Note what `resolveActor()` does _not_ use: the secret key. It runs on the request-bound publishable-key client, so even the identity lookup is filtered by RLS — `users_select_own` lets a signed-in user read exactly their own row and nothing else.

**Four IDOR bugs were closed by making this the single door.** Handlers used to take a user id from the request and trust it. The convention now is absolute: every actor id comes from the verified session. Don't add a fifth.

### 3. RLS underneath both

19 table policies and 12 storage policies. The point of this layer is that a handler which forgets a `.eq('user_id', …)` filter still cannot read another user's rows.

| Policy family                                                        | Effect                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `songs_select_public`                                                | What lets anonymous visitors browse the catalogue at all                                           |
| `songs_write_admin`                                                  | Every write re-checks ADMIN in the database, on top of `requireAdmin()`                            |
| `playlists_owner_all`, `playlist_songs_owner_all`, `likes_owner_all` | Owner-scoped; a filter forgotten in a handler is still not a leak                                  |
| `upload_jobs_owner_all`, `upload_job_items_owner_all`                | Ownership **and** a live ADMIN role, so one admin cannot drive another's job                       |
| `users_select_own`, `users_update_own`                               | Self-only. Column privileges separately stop a user writing their own `role`                       |
| `song_audio_*_admin`                                                 | `song-audio` has **no** SELECT policy for ordinary users — the linchpin of the signing story below |
| `song_covers_select_public`, `artist_images_select_public`           | Public read, so `next/image` gets a stable, cacheable src                                          |

Two helper functions carry the RLS predicates: `current_app_user_id()` and `is_admin()`, both matching on `supabase_user_id` and both requiring `status = 'ACTIVE'`. Aggregates that need to cross an owner boundary — `song_like_counts()` returning `(song_id, count)` — are `SECURITY DEFINER` functions returning only the aggregate, never the underlying rows.

---

## Walkthrough: playing a song

1. The browser renders `/` (a client component) and `useSongsInfinite()` in `src/hook/query/useSongQueries.ts` issues `GET /api/get-songs?page=1&limit=20` through the shared axios instance. No `Authorization` header is attached — every endpoint is same-origin, so the browser sends the Supabase auth cookies on its own and `@supabase/ssr` reads the session from them. (Putting the access token in a header would be strictly worse: it is readable from JavaScript and it is how a bearer token once ended up in the browser console.)
2. Middleware matches `/api/get-songs` against the public list and passes it through, refreshing cookies on the way.
3. The handler validates `?page=&limit=` with `parsePagination()` — zod, `limit` clamped to 100, junk rejected with a 400 rather than silently becoming `NaN`. Optional `?artist=`, `?album=`, `?movie=` filters narrow the same query. The artist filter uses `.filter('artist', 'cs', '{"…"}')` with manual quoting rather than `.contains()`, because `.contains()` builds an unquoted array literal and a comma _inside_ one artist name would be read as a second element and silently match zero rows.
4. PostgREST returns the page plus an exact count.
5. `toSongDtos()` does exactly **two** extra round-trips for the whole page, in parallel: `song_like_counts(p_song_ids)` for the badges, and one `createSignedUrls(paths, TTL)` call in `src/lib/storage.server.ts` for every track on the page. Never one per track. Cover URLs need no round-trip at all — `song-covers` is public, so `coverUrl()` is a pure function of the stored path.
6. The response goes out `private, no-store`, because it now carries expiring tokens.
7. The `<audio>` element requests that URL directly from Supabase Storage's CDN. **The app server is not in the audio path and never serves a byte of media.** Seeks are `Range` requests against the same URL, which is why the TTL has to outlive the listening session.

If signing fails for one object — a half-finished upload — `signAudioUrls()` returns a map missing that entry rather than throwing, and the DTO's `audioUrl` is `null`. One broken track must not 500 a whole listing, but the UI is required to surface it rather than mounting a dead player.

## Walkthrough: uploading a song

No file bytes pass through any function at any point.

1. The admin picks up to 10 files in `UploadSongsPanel`. `music-metadata`'s `parseBlob` reads ID3 tags and embedded cover art **in the browser**. Unreadable tags fall back to the filename rather than failing the file; a comma-separated artist tag is split.
2. `POST /api/upload-song` receives a _manifest_ — names, sizes, content types — never bytes. `requireAdmin()` gates it. Zod bounds every field, including size against `MAX_AUDIO_BYTES`, so a 100MB mistake produces a useful 400 before an upload starts.
3. The handler mints a job: a `upload_jobs` row owned by the session user with a 24h `expires_at`, and one `upload_job_items` row per file whose `audio_path` / `cover_path` come from `assetPaths(jobId, itemId, …)` — **ids the server generated**, never the uploaded filename. A filename is attacker-controlled text; letting it into a bucket key invites traversal, collisions between two admins uploading `track.mp3`, and unicode lookalikes. The original name is kept in `original_name`, where it is only ever displayed.
4. Those item rows are inserted on the **secret key**, via `insertUploadJobItems()`. `authenticated` has no INSERT grant on `upload_job_items` at all. The reason is spelled out in `20260810120000_revoke_upload_job_items_insert.sql`: this insert used to run through the admin's own client, and Postgres cannot tell "the server inserting a row it just derived" apart from "the browser inserting whatever it wants" when both arrive as the same role and the same JWT. An admin could otherwise insert an item with an arbitrary `audio_path`.
5. The browser uploads to `…/storage/v1/upload/resumable` over TUS in **6MB chunks** (`tus-js-client`). 6MB is not a tunable — Supabase's resumable endpoint requires every chunk but the last to be exactly that. The bearer token is the caller's own access token, and `song_audio_insert_admin` is what actually decides whether the write lands: a signed-in non-admin holding a valid token gets a 403 from Storage itself. The session URL is persisted to `upload_session_id` so an interrupted upload resumes from the server-side offset instead of restarting.
6. `POST /api/upload-song/complete` takes only `{ jobId, itemId, metadata }`. It **re-reads the paths from `upload_job_items`** rather than believing the caller, then calls `objectSize()` and requires the stored object to exist and to be _exactly_ `total_bytes`. Without that, an admin could register a song whose audio is a 12-byte stub or was never uploaded. A missing _cover_ degrades to no cover rather than failing the song. The insert sets `uploaded_by_user_id` from the session, and `songs_write_admin` re-checks ADMIN on the way in. Completion is idempotent — a retry sees `item.song_id` already set and returns 200 rather than inserting twice.
7. `POST /api/upload-song/sweep-expired` closes the loop for abandoned jobs, deleting objects with no `songs` row pointing at them. It accepts an admin session _or_ `Authorization: Bearer $CRON_SECRET`. No schedule is wired up today. Honest limit: it cannot reclaim an in-progress resumable upload that was never finalized, because Storage does not expose such an object to `list()` at all — only Supabase's own multipart lifecycle can.

---

## Decisions worth knowing

Each of these looks like a mistake until you know why it exists.

**Exactly one module may sign a playback URL.** `src/lib/storage.server.ts` is `import 'server-only'` and holds the sole `SUPABASE_SECRET_KEY` client, which bypasses RLS and is deliberately never exported — the only thing the file offers is "sign these paths". The first cut let every signed-in caller read `song-audio` through their own publishable-key client. That was the bug: **Supabase Storage authorizes `/object/sign/` against the bucket's SELECT policy**, so any SELECT policy on `song-audio` lets that role open the console, `list()` the entire catalogue, `download()` it, and mint its _own_ signed URLs at any TTL to hand to third parties. The 6h TTL constrained nobody, because the caller chose the TTL. The bucket now has no SELECT policy except for admins, and the module only ever signs paths a handler already read out of `songs` for that request. **Tradeoff, stated honestly:** this buys expiry and server-controlled issuance, not secrecy. `/` and `/api/get-songs` are public and the server signs for anonymous callers too, exactly as it did when the media sat on Cloudinary. What is real: a leaked link stops working, and nobody but this module can enumerate the bucket or choose a TTL. Do not write a comment claiming more than that, and never re-add a broad SELECT policy.

**Sign once per listing, not once per play.** A fresh signed token is always a CDN miss; a repeated token caches. This was measured directly — MISS → HIT → HIT on a repeated token, MISS on a new token over the same object. Re-signing per playback would therefore turn every seek into a cold origin fetch, because `<audio>` seeking is a `Range` request against the same URL. So `AUDIO_URL_TTL_SECONDS` is six hours: the one URL has to outlive the listening session. The tradeoff is that a leaked URL stays live for up to six hours, and every endpoint carrying one must be `private, no-store` so no shared cache hands out a part-spent token.

**Uploads bypass the function entirely.** A Vercel request body caps around 4.5MB and a track can be 100MB, so a proxied upload was never merely slow — it was impossible. The old handler also kicked off a "background" pass that outlived the response, which a serverless function is free to freeze the moment it responds. Both problems vanish once the bytes never arrive: browser → Storage over TUS in 6MB chunks, with the API reduced to minting server-derived paths and confirming afterwards. The tradeoff is a three-step flow with real intermediate state (`upload_jobs`, `upload_job_items`, a sweep for abandonment) instead of one endpoint. Don't "simplify" it back into a form-data endpoint.

**Roles are read live from `public.users.role`, never from a JWT claim.** `app_metadata` freezes at signup and survives a demotion; `user_metadata` is writable from the browser outright. So `requireAdmin()` spends one PostgREST round-trip per request asking the database what the caller is _right now_. The cost is the feature: a demoted admin loses access on their next request, not on their next token refresh. The same reasoning is why middleware doesn't check roles — there, the round-trip would be paid on every matched request rather than only on the ones that need it.

**Email is not an identity.** `supabase_user_id` is the only link between an auth identity and an app row. Nothing in `src/` filters `users` by email; the column is read for display only. The signup trigger's `ON CONFLICT DO NOTHING` deliberately leaves a colliding identity with _no_ profile — a fail-closed 403 — rather than adopting an existing row, because `DO UPDATE SET supabase_user_id = new.id` is an account-takeover primitive. `users_email_key` was dropped for the matching reason: the trigger fires on `auth.users` INSERT, which is _before_ email confirmation, so a stranger could sign up as `founder@yourdomain`, never confirm, and permanently lock out the real owner with no self-service repair. After the drop, two rows sharing an address are simply two distinct accounts, told apart by `supabase_user_id` — exactly as `auth.users` tells them apart. Enforcing who owns an address is GoTrue's job, not this table's.

**Artists and albums are derived, not modelled.** `artist_song_counts()` `cross join lateral unnest`es `songs.artist text[]`; `album_song_counts()` aggregates `songs.album`. Both run at query time. `public.artists` exists only as a _profile side-table keyed by name_, consulted afterwards for a photo and bio — there is no foreign key, and an artist name with no row there is the normal case, not an error. **The tradeoff is real and it is a data-integrity one:** "A.R. Rahman" and "AR Rahman" are two artists, a typo in an ID3 tag forks one permanently, and nothing can rename an artist everywhere at once. It is chosen because the catalogue is admin-curated from ID3 tags at small scale, where a normalised model means building a reconciliation UI nobody has built. **When to normalise:** the moment a human needs to merge or rename artists, or the moment anything outside this app consumes artist identity. That is a data migration with an alias table, not a code change.

**`songs.uploaded_by_user_id` is `ON DELETE RESTRICT`, not cascade.** Every song is uploaded by an admin, so a cascade on that user would take the catalogue down with the account. The tradeoff is that a user row cannot simply be deleted — which is intended. Deactivate instead (`status = 'INACTIVE'`), which `resolveActor()` and `current_app_user_id()` both honour.

**The TanStack Query cache is cleared on an auth change.** `src/components/Providers.tsx` holds the `QueryClient` in `useState` at the root layout, so it lives for the life of the tab. Sign-in and sign-out do `router.push`/`replace` + `router.refresh()`, and `refresh()` re-renders Server Components while **deliberately preserving client state** — nothing remounts, nothing is torn down. Without an explicit clear, on a shared device everything the previous user fetched stays readable for the full 10-minute `gcTime`: their playlists render, their likes render, and `['admin-status']` still says `isAdmin: true` so `/admin` draws its panels for someone who is not an admin. (Rendering only — every endpoint re-checks server-side, so it is a data leak and a confusing-UI bug, not privilege escalation.) The subscription is narrower than "clear on every event", and that narrowness is itself load-bearing: it clears only when the signed-in user id actually _changes_, and it ignores the very first event the listener sees. `TOKEN_REFRESHED` fires hourly for the same user, and a plain reload of an already-authenticated tab emits `SIGNED_IN` — including the silent reload Chrome performs when it discards a backgrounded tab. Clearing on those put every loading skeleton back on screen for a user who never signed out. `clear()` rather than `invalidateQueries()`, because invalidation leaves the previous user's rows on screen until the network answers.

---

## Project structure

```
src/
├─ app/                          pages + the 20 Route Handlers — Next.js is the backend
│  ├─ layout.tsx                 root shell: fonts, Providers, player, the @modal slot
│  ├─ page.tsx                   home — the shelves; a client component reading /api/get-songs
│  ├─ globals.css                Tailwind v4 CSS-first @theme; design tokens, light only
│  ├─ error.tsx  global-error.tsx  not-found.tsx  loading.tsx
│  │
│  ├─ @modal/                    parallel route slot, rendered alongside the page
│  │  ├─ default.tsx             renders nothing when no modal is intercepted — required,
│  │  │                          or a hard navigation loses the slot and 404s
│  │  ├─ (.)sign-in/             intercepting routes: these render OVER the current page,
│  │  ├─ (.)sign-up/             so signing in never loses the page you were on. The
│  │  └─ (.)forgot-password/     full pages below still serve a direct hit or a refresh
│  │
│  ├─ api/                       every handler derives the caller from the session — see API.md
│  │  ├─ get-songs/  search/
│  │  ├─ artists/  artists/profile/  albums/
│  │  ├─ playlists/  playlists/[playlistId]/  post-playlist/
│  │  ├─ remove-playlist-song/  delete-playlist/
│  │  ├─ like-song/  get-liked-songs/  check-admin/
│  │  ├─ upload-song/  upload-song/complete/  upload-song/sweep-expired/
│  │  └─ admin/                  delete-song, update-song, artist-photo, artist-profile
│  │
│  ├─ auth/callback/route.ts     outside api/ on purpose: the PKCE ?code= exchange and
│  │                             ?token_hash= one-time tokens. `next` is restricted to a
│  │                             same-site path, so it cannot become an open redirect
│  │
│  ├─ artist/[name]/             browse pages keyed by a VALUE on songs (artist[] / album /
│  ├─ album/[name]/              movie), not by a foreign key — the catalogue is derived.
│  ├─ movie/[name]/              Each decodes its own segment: useParams() does not
│  │                             (verified live), so "Burna%20Boy" would match zero songs
│  ├─ artists/  albums/          infinite directory grids reporting the server's TRUE total,
│  │                             not the count loaded so far
│  ├─ songs/                     the full catalogue, 10/page with the page number in the URL
│  ├─ liked/  playlist/  playlist/[playlistId]/  admin/
│  ├─ sign-in/  sign-up/         the full-page twins of the @modal interceptions above
│  ├─ forgot-password/           reachable signed OUT — it exists for people who can't sign in
│  ├─ reset-password/            public in middleware so a session-less visit renders the
│  │                             page's own "link expired" state instead of bouncing to
│  │                             /sign-in?next=/reset-password. Neither belongs in AUTH_ROUTES:
│  │                             that list redirects signed-in users away, which would lock
│  │                             out exactly the people arriving with a fresh recovery session
│  └─ utils/
│     ├─ ApiResponse.ts          the { success, message, data } envelope every handler returns
│     ├─ formatTime.ts  truncateByLetters.ts
│
├─ components/
│  ├─ ui/                        shadcn/ui (new-york) primitives over Radix — 14 of them
│  ├─ admin/                     UploadSongsPanel, ManageSongsPanel, ArtistsPanel
│  ├─ auth/                      AuthCard/AuthModal + the five forms; Supabase Auth has no
│  │                             appearance API, so these are ours, built from ui/ and tokens
│  ├─ states/                    EmptyState, ErrorState, and the two skeletons
│  ├─ Providers.tsx              QueryClient + SupabaseUserProvider, and the auth-change
│  │                             cache clear described above. Created once per tab
│  ├─ MusicPlayer.tsx            the persistent bottom bar; owns the single <audio> element
│  ├─ ExpandedPlayer.tsx         full-screen now-playing OVER the same audio element —
│  │                             a second element would restart playback
│  └─ Shelf / SongCard / ArtistCard / AlbumCard / PlayList / Header / Navbar / …
│
├─ context/
│  └─ SongContextProvider.tsx    queue, current song, shuffle, repeat. The queue is whatever
│                                list you started from, so "play all" on an artist queues
│                                that artist, not the catalogue
│
├─ hook/                         the TanStack Query layer — split in two ON PURPOSE
│  ├─ apiHooks/                  thin axios wrappers, one per resource. Knows a URL and a
│  │                             response type and nothing else: no cache, no React state.
│  │                             useApiClient.ts memoises the client so query fns stay stable
│  └─ query/                     useQuery/useInfiniteQuery/useMutation + the cache KEYS and
│                                invalidations. Keys carry no user id — responses are scoped
│                                by the session cookie, so a key naming a user could only lie
│
├─ hooks/                        standalone hooks — no server state, hence a separate folder
│  ├─ useSupabaseUser.tsx        the session, resolved ONCE in a provider. It used to be a
│  │                             plain hook, so every call site ran its own getUser() and its
│  │                             own subscription. Client-side only — it picks which controls
│  │                             to draw, it never decides what is allowed
│  ├─ useMediaSession.ts         mirrors the track to OS lock screens and hardware media keys
│  └─ useInfiniteScroll.ts
│
├─ lib/
│  ├─ auth.ts                    requireUser / requireAdmin / optionalUser — the ONLY way a
│  │                             handler learns the caller. Ids never come from a request
│  ├─ api.ts                     zod pagination + clamp, and PostgREST error-code mapping.
│  │                             The clamp lives in the schema so no handler can forget it
│  ├─ dto.ts                     snake_case rows → the camelCase shape the UI reads, plus
│  │                             the explicit column lists. Batches like-counts and signing
│  ├─ storage.server.ts          server-only. The ONLY module that may sign a playback URL,
│  │                             the only holder of the secret key, and the upload sweeper
│  ├─ storage.ts                 bucket names, object paths, TTL, size and mime limits.
│  │                             Isomorphic on purpose — the browser needs the same path
│  │                             rules the server uses, and a second copy is how they drift
│  ├─ tusUpload.ts               browser-side resumable upload. Never sees a secret; the
│  │                             bearer token is the caller's own and Storage RLS decides
│  ├─ authForm.ts                the password rules and error phrasing both auth forms share
│  ├─ theme.ts                   the two colours that cannot read a CSS variable:
│  │                             <meta name="theme-color"> and react-hot-toast's inline style
│  ├─ database.types.ts          GENERATED by `npm run db:types`. Never hand-edit
│  └─ utils.ts                   cn()
│
├─ types/models.ts               API wire shapes — deliberately ≠ database row shapes
├─ utils/
│  ├─ supabase/                  client.ts (browser) / server.ts (per-request, never a
│  │                             module-level singleton — that would leak a session between
│  │                             requests) / middleware.ts (refresh + deny-by-default)
│  └─ axios/axios.ts             the shared instance; same-origin, cookies, no bearer header
└─ middleware.ts                 wires updateSession into Next; the matcher skips _next and
                                 static assets but ALWAYS runs for /api

supabase/migrations/             12 SQL files, append-only. An applied file is history:
                                 correct it with a NEW migration, never in place
docs/                            ARCHITECTURE.md (this) · API.md · DEPLOYMENT.md
public/appImg/                   the README screenshots
```

### The client data layer: `apiHooks/` → `query/` → components

Data flows one direction through exactly three tiers.

| Tier                  | Owns                                                                | Must not                           |
| --------------------- | ------------------------------------------------------------------- | ---------------------------------- |
| `src/hook/apiHooks/*` | A URL, a request shape, a response type                             | Hold state or know about the cache |
| `src/hook/query/*`    | Cache keys, pagination, staleness, invalidation, optimistic updates | Build URLs ad hoc                  |
| Components            | Rendering                                                           | Import from `apiHooks/`            |

A component that reaches past `query/` and calls an `apiHooks` function directly is how a fetch ends up _outside_ the cache: it stops being invalidated when a mutation succeeds, and — the sharper failure — it survives `queryClient.clear()` on an auth change, which is the one thing that must not happen on a shared device. The split exists so that rule is mechanically checkable rather than a matter of discipline.

The query defaults are set once in `Providers.tsx`: `staleTime` 5 min, `gcTime` 10 min, `retry: 1`, and both `refetchOnWindowFocus` and `refetchOnMount` off — the catalogue does not change while you are looking away, and refetching on focus was visible as the app re-flashing its skeletons on every tab switch.

---

## Data model

13 tables, of which **8 are actively queried**.

| Table                             | Role                                                                                                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                           | The app's own user row. `supabase_user_id` is the only link to an auth identity; `role` and `status` are read live on every authorized request                                                                   |
| `songs`                           | The catalogue. `artist text[]` and `composers text[]`, plus plain `album` / `movie` / `genre` text. `audio_path` / `cover_path` are Storage object keys, not URLs. `uploaded_by_user_id` is `ON DELETE RESTRICT` |
| `artists`                         | A **profile side-table keyed by `name`** — bio and `image_path` only. No FK to `songs`; a name with no row here is normal                                                                                        |
| `playlists`, `playlist_songs`     | Per-user, owner-scoped by RLS                                                                                                                                                                                    |
| `likes`                           | Per-user. The public aggregate comes from `song_like_counts()`, never from reading the rows                                                                                                                      |
| `upload_jobs`, `upload_job_items` | The upload state machine. `authenticated` has no INSERT on `upload_job_items` at all                                                                                                                             |

Seven Postgres functions: `set_updated_at` (the shared trigger), `handle_new_auth_user` (the signup trigger, `ON CONFLICT DO NOTHING`), `current_app_user_id` and `is_admin` (the RLS predicates), `song_like_counts` (`SECURITY DEFINER`, aggregate only), and `artist_song_counts` / `album_song_counts` (the derived directories). Three storage buckets: `song-audio` **private**, `song-covers` **public**, `artist-images` **public** — the latter two public because `next/image` needs a stable src and `next.config.ts` pins `remotePatterns` to `/storage/v1/object/public/**`, which a signed URL would never match.

**The honest note.** `albums`, `movies`, `album_artists`, `song_credits` and `webhook_events` — 5 of the 13 — are queried by nothing. They are residue from an abandoned normalised catalogue model and from the Clerk era, carried through the initial schema migration rather than dropped. `songs.album_id` and `songs.movie_id` are likewise dead columns; the live path is the plain `songs.album` / `songs.movie` text. They are harmless at runtime and actively misleading to anyone reading the schema cold, which is why they are named here rather than quietly left. Dropping them belongs in the same pass as giving artists real identity.

---

Next: the full endpoint reference in [API.md](./API.md), the deployment checklist in [DEPLOYMENT.md](./DEPLOYMENT.md), or back to [the README](../README.md).
