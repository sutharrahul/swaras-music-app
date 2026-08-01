# Deploying Swaras to Vercel

Takes this repo from "never deployed" to "running on Vercel against Supabase". Follow the
sections in order — later steps assume earlier ones.

Project ref throughout: **`wwtglvbctakstnguqrzk`**, API URL
`https://wwtglvbctakstnguqrzk.supabase.co`.

Shell variables used by the commands in this guide:

```bash
export REF=wwtglvbctakstnguqrzk
export SB=https://$REF.supabase.co
export PK='sb_publishable_...'          # NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export SITE=https://<your-production-domain>
```

---

## 1. Prerequisites

Everything here must be true before the first deploy. None of it is created by the deploy.

| # | Thing | State today | How to satisfy it |
|---|---|---|---|
| 1 | Supabase project exists | ✅ `wwtglvbctakstnguqrzk` | — |
| 2 | Supabase project is on **Pro** | ❓ verify | Free caps every Storage object at **50 MB**, hard and unraisable. A ~100 MB master is rejected outright. Dashboard → Organization → Billing. |
| 3 | Database schema applied | ⚠️ partly — 4 of 7 migrations applied, see §2 | §2 |
| 4 | Storage buckets exist | ⚠️ `20260809150000_storage.sql` creates them, and it is **not applied yet** | §1.1, then §2 |
| 5 | Storage RLS policies | ⚠️ same migration, same state — written, not applied | §1.1, then §2 |
| 6 | Email auth provider enabled | ❓ verify | §1.2 |
| 7 | An ADMIN user exists | ❌ | §7.2 — must be done in SQL, there is no API path |
| 8 | Vercel account + team slug known | ❓ | §4 needs the slug verbatim |
| 9 | Production domain decided | ❓ | Needed before §3 and §4. Do not defer — the Supabase Site URL is baked into every confirmation email at send time. |

Local tooling: Node ≥ 20 and `npx supabase` (v2.111.0 resolves in this repo already — no global
install needed). There is **no Supabase CLI login on this machine**, so §2 starts with
`npx supabase login`.

### 1.1 Storage buckets — now a migration, and the bucket layout changed

**This section used to say "create three buckets by hand, `song-audio` public". Both halves of that
are now wrong.** `supabase/migrations/20260809150000_storage.sql` creates the buckets and their
policies, so `npm run db:push` is the whole step — but note that **this migration has not been
applied yet** (§2), so on the live project the buckets do not exist and nothing will play until it
is. There are **two** buckets, not three:
`uploads-staging` was never built, because TUS writes straight to the destination object and a
staging hop would only double the bytes stored and add a copy step.

| Bucket | Public | File size limit | Allowed MIME types |
|---|---|---|---|
| `song-audio` | **Private** | `104857600` (100 MB) | `audio/mpeg, audio/mp3, audio/wav, audio/x-wav, audio/wave, audio/flac, audio/x-flac, audio/mp4, audio/m4a, audio/x-m4a, audio/aac, audio/ogg` |
| `song-covers` | **Public** | `10485760` (10 MB) | `image/jpeg, image/png, image/webp, image/gif` |

**`song-audio` is private, reversing the recommendation this section used to make.** The two
arguments, honestly:

- *Seeking still works.* An `<audio>` element seeks by re-requesting with a `Range` header, and
  Supabase serves signed objects through the same endpoint as public ones, honouring `Range` on
  both. What breaks seeking is **expiry**, not signing: once a token dies, the next seek outside the
  buffered region fails while buffered playback continues. Hence the six-hour TTL in
  `src/lib/storage.ts`, and hence every endpoint carrying a signed URL is `private, no-store`.
- *The CDN cost is real, and was the old section's point.* A token lives in the cache key, so each
  caller's URL is a distinct cache entry and a cold one is an origin pull. Signing once per
  **listing** with a long TTL — rather than once per play — is what keeps that to roughly one origin
  fetch per listener per TTL window instead of one per playback.

**Measured against this project**, not inferred — a 1 MB object in a throwaway bucket, probed with
real `Range` requests, bucket removed afterwards:

| Request | `cf-cache-status` |
|---|---|
| Public URL, 1st → 2nd → 3rd | MISS → **HIT** → **HIT** |
| Signed token A, 1st → 2nd | MISS → **HIT** |
| Signed token B (fresh token, same object) | **MISS** |

Both returned `206` with a correct `content-range`, so **`Range` on signed URLs is confirmed, not
assumed** — that was the question that could have killed this design. The second row is the useful
one: the *same* token caches and hits, so the cost is one cold origin fetch **per token**, not per
seek. Sign once per listing and reuse the URL for every range request in the session.

The trade that decided it: a public bucket makes every object URL a permanent, unauthenticated
bearer token for the entire catalogue. Be precise about what private buys, though — **it is not
secrecy**. `/` and `/api/get-songs` are public routes and anonymous visitors are meant to listen
(they could before this migration), so the server signs playback URLs for anonymous callers too, and
anyone willing to call the endpoint can reach the audio. What private actually buys is that URLs
**expire**, that only the server can **issue** one, and that nobody can enumerate the bucket or pick
their own TTL. Cover art stays public, because `next/image` caches by src URL (an expiring src is a
guaranteed miss and eventually a broken image) and the covers are already served to anonymous
visitors on `/`.

**Signing is server-side only, and that is load-bearing.** There is deliberately no SELECT policy on
`song-audio` for ordinary users. An earlier draft had `song_audio_select_authenticated` (SELECT to
every signed-in user); because Storage's `/object/sign/` endpoint authorises against the SELECT
policy, that let any signed-in user list and download the whole catalogue from the browser console
**and mint their own signed URLs at any TTL** for anonymous third parties. Playback URLs now come
only from `src/lib/storage.server.ts` — a `server-only` module using `SUPABASE_SECRET_KEY`, which
signs just the paths the handler already read out of `songs`.

Uploads are browser-driven TUS with `x-upsert: true`, which needs `SELECT` **and** `INSERT` **and**
`UPDATE` — the migration grants all three to **admins** on both buckets, or resumed uploads fail with
a confusing 403. (Admin SELECT is also what `/api/upload-song/complete` uses to verify the object
landed at the declared size. An admin can consequently sign their own URLs; accepted, since the same
role can delete the catalogue outright.) The browser writes with the **publishable** key and the
user's own token, so `storage.objects` RLS is the only thing standing between a signed-in non-admin
and a write. The secret key is used server-side for signing playback URLs and nothing else.

If `db push` fails on section 3 of that migration with `must be owner of relation objects`, the
`postgres` role on this project does not own `storage.objects`; recreate those policies from
Dashboard → Storage → Policies with the same predicates. See the migration's header comment.

### 1.2 Auth providers

Dashboard → Authentication → Providers:

- **Email**: enabled. Decide "Confirm email" on/off now — with it on, §7.1 requires reading a real
  inbox, and the confirmation link's destination is frozen at send time by §3.
- **Google**: enable only if the sign-in UI offers it. The provider-side callback you register with
  Google is the fixed Supabase URL `https://wwtglvbctakstnguqrzk.supabase.co/auth/v1/callback` —
  **not** a Vercel URL — so preview deployments need no Google config changes. Only the Supabase
  redirect allowlist in §3 matters for previews.

---

## 2. Applying the database schema

**Status: partly applied — 4 of 7.** These four were pushed to `wwtglvbctakstnguqrzk` (Mumbai) with
`npx supabase db push --db-url ...`, which does not require `supabase login`, and are recorded in
`supabase_migrations.schema_migrations`, so a re-run is a no-op:

1. `20260809130000_init_schema.sql`
2. `20260809130100_rls.sql`
3. `20260809130200_provision_app_user.sql`
4. `20260809140000_song_like_counts.sql`

**Three are still pending** and must be pushed before the app works end to end:

| Pending migration | What it does | Consequence of not applying it |
|---|---|---|
| `20260809150000_storage.sql` | Creates both buckets and their `storage.objects` policies; drops the Cloudinary URL columns | No buckets: uploads fail and nothing plays |
| `20260809160000_email_is_not_an_identity.sql` | Drops `users_email_key` | A stranger who signs up (no confirmation needed) with someone's address permanently blocks that person from ever getting a profile row — every authenticated route 403s for them, forever |
| `20260809160100_upload_job_items_column_grants.sql` | Replaces the table-wide `update` grant with a column grant | An admin can rewrite `audio_path` from the browser and register a song for an object they never uploaded |

The steps below remain the reference for a fresh environment.

Read the header comment in `20260809130000_init_schema.sql` before running anything. Every
statement is `IF NOT EXISTS`-guarded, which makes re-running harmless but **does not** make it
correct against a database that already carries the old Prisma-era tables: `CREATE TABLE IF NOT
EXISTS` silently does nothing when the table exists, so an old `users` would keep
`vendor_id`/`vendor_name` and never gain `supabase_user_id`. Confirm the target database has no
`public.users` before you start:

```bash
curl -s -o /dev/null -w '%{http_code}\n' "$SB/rest/v1/users?select=id&limit=1" -H "apikey: $PK"
# 404 (relation does not exist) => clean, proceed.
# 401/403 => the table exists and is locked down. STOP and inspect before running migrations.
```

### Route A — Supabase CLI (**use this one**)

```bash
cd /Users/praddeepsuthar/Documents/rahul/music-app

npx supabase login                    # opens a browser; no login exists on this machine yet
npx supabase link --project-ref wwtglvbctakstnguqrzk
                                      # prompts for the database password —
                                      # Dashboard → Project Settings → Database → Reset password
                                      # if nobody has it

npx supabase db push --dry-run        # prints the migrations it WOULD apply. Read this.
npx supabase db push                  # or: npm run db:push
```

Safer than the SQL editor, and it is the route to use, because:

- it records each file in `supabase_migrations.schema_migrations`, so the database knows what it
  has and a re-run is a no-op rather than a re-execution;
- it applies files in filename order, which matters — `rls.sql` references tables from
  `init_schema.sql`, and `provision_app_user.sql` references both;
- each file runs in a transaction, so a failure half-way leaves nothing behind.

The SQL editor has none of those three properties.

`db push` needs a **direct** database connection. `db.wwtglvbctakstnguqrzk.supabase.co` is
IPv6-only on this project (verified: `dig AAAA` returns
`2406:da1a:82a:9d01:bb3b:d52b:d9a0:dc54`, `dig A` returns nothing). On an IPv4-only network the
CLI falls back to the Supavisor pooler automatically; if it does not and you get a connection
timeout, use Route B.

### Route B — Dashboard SQL editor (fallback only)

Dashboard → SQL Editor → New query. Paste and **Run one file at a time, in this order**, checking
for errors before moving on:

1. `supabase/migrations/20260809130000_init_schema.sql`
2. `supabase/migrations/20260809130100_rls.sql`
3. `supabase/migrations/20260809130200_provision_app_user.sql`
4. `supabase/migrations/20260809140000_song_like_counts.sql`
5. `supabase/migrations/20260809150000_storage.sql`
6. `supabase/migrations/20260809160000_email_is_not_an_identity.sql`
7. `supabase/migrations/20260809160100_upload_job_items_column_grants.sql`

The editor runs as `postgres`, which is what `provision_app_user.sql` needs (it creates a trigger
on `auth.users`) and what `storage.sql` needs (it creates policies on `storage.objects`, owned by
`supabase_storage_admin`). Its cost is that Supabase has no record you ran anything: a later
`npx supabase db push` will try to apply them again. If you take this route, immediately
run `npx supabase migration repair --status applied <version>` for each version you ran.

### What to check afterwards

```bash
# 1. Tables exist and are reachable through PostgREST.
curl -s -o /dev/null -w 'songs anon: %{http_code}\n' \
  "$SB/rest/v1/songs?select=id&limit=1" -H "apikey: $PK"
# expect 200 (an empty array is correct — the catalogue is empty)

# 2. users is NOT readable by anon. This proves the `revoke all ... from anon` in rls.sql landed.
curl -s -o /dev/null -w 'users anon: %{http_code}\n' \
  "$SB/rest/v1/users?select=email&limit=1" -H "apikey: $PK"
# expect 401 (permission denied for table users). A 200 with rows means rls.sql did not apply.

# 3. webhook_events is sealed — RLS on, zero policies, zero grants.
curl -s -o /dev/null -w 'webhook_events anon: %{http_code}\n' \
  "$SB/rest/v1/webhook_events?select=svix_id&limit=1" -H "apikey: $PK"
# expect 401
```

In the SQL editor, confirm RLS is on everywhere and the signup trigger exists:

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;
-- every row must show relrowsecurity = true

select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
-- must include on_auth_user_created
```

If `relrowsecurity` is false anywhere, stop — the catalogue and every user's playlists are
world-writable until it is fixed.

### 2.1 Generate types (optional, local only)

```bash
npm run db:types    # writes src/lib/database.types.ts
```

Requires the CLI link from Route A. Not part of the deploy; the build does not run it.

---

## 3. Supabase Auth configuration for Vercel

**This is the single most common way a Supabase app works perfectly on `localhost` and fails on
Vercel.** Do it before the first deploy.

Dashboard → Authentication → URL Configuration.

**Site URL** (exactly one value, no wildcard, no trailing slash):

```
https://<your-production-domain>
```

**Redirect URLs** (add each as its own entry):

```
http://localhost:3000/**
https://<your-production-domain>/auth/callback
https://<your-production-domain>/auth/confirm
https://<project-name>-*-<vercel-team-slug>.vercel.app/**
https://<project-name>-git-*-<vercel-team-slug>.vercel.app/**
```

`<vercel-team-slug>` is the **slug** of the Vercel team or personal account, not its display name —
Vercel → Settings → General. `<project-name>` is the Vercel project name. Both appear in any
preview hostname; deploy once and copy them out of the URL if unsure.

### Why it breaks without this

The two settings do different jobs:

- **Site URL** is the default redirect target when an auth call passes no `redirectTo`, **and the
  silent fallback when a supplied target fails the allowlist**.
- **Redirect URLs** is the allowlist itself.

Vercel mints two hostnames per branch, and the per-commit one changes on **every push**:

```
<project-name>-<9-random-chars>-<team-slug>.vercel.app    # per commit
<project-name>-git-<branch>-<team-slug>.vercel.app        # per branch, stable
```

So a tester signs up on a preview, the app computes `emailRedirectTo` as that preview origin,
Supabase finds it is not allowlisted, and **does not error** — it substitutes Site URL. The
confirmation email lands the tester on production, or on `http://localhost:3000` if Site URL was
never changed off the default. The failure is silent at every step.

Wildcard semantics that make the entries above correct: `*` matches any run of **non-separator**
characters, `**` matches anything, and the separators are `.` and `/`. So `*` crosses hyphens
(spanning both the random hash and `git-<branch>`) but never crosses a dot — which is exactly the
property that keeps the pattern pinned to one project in one team.

Two traps:

- **Never write a leading `**`** (`https://**-<slug>.vercel.app/**`). `**` matches `/`, so an
  attacker-controlled `https://evil.example/x-<slug>.vercel.app/` can satisfy it. Use `*`.
- **Do not broaden to `https://*.vercel.app/**`.** That makes any deployment on all of
  `vercel.app`, owned by anyone, a valid destination for your auth codes — a straightforward
  account-takeover primitive. Always pin the team slug.

**Unconfirmed:** branch names containing a `.` (e.g. `release/1.2`). `*` does not match `.`, so
such a preview URL would not match — *if* Vercel preserves the dot when sanitising the branch into
a hostname. We could not confirm Vercel's sanitisation rules. Avoid dotted branch names, or verify
manually the first time you use one.

Also note that PKCE code-verifier cookies are **host-only**. Each preview URL is a separate host and
therefore a completely separate session: a link issued for one preview host cannot be exchanged on
another, and testers must sign in again on each preview URL. That is correct behaviour, not a bug —
`vercel.app` is on the Public Suffix List so browsers reject `Domain=.vercel.app` outright. Do not
try to defeat it by setting `domain` in `cookieOptions`.

---

## 4. Vercel project settings

Import the repo at vercel.com → Add New → Project. Then Settings:

| Setting | Value | Notes |
|---|---|---|
| Framework preset | **Next.js** | Auto-detected. Leave it. |
| Root directory | repo root | Not `src/`. |
| Build command | *unset* (uses `package.json` `build`) | Currently `next build` — correct. It was `prisma generate && next build`; that has already been fixed. If anyone re-adds a `prisma generate` prefix after Prisma is gone, **the build fails on Vercel only**, because a developer with stale `node_modules` still has the binary locally. |
| Install command | *unset* | Auto-detected from `package-lock.json` → `npm install`. |
| Node.js version | **22.x** — set it explicitly | `package.json` declares `"engines": { "node": ">=20" }`, and `engines` **overrides** the dashboard. Per Vercel's mapping a `>=20.0.0` range resolves to the **latest 24.x**, not 20. That works with Next 15.5 / React 19, but the deployed runtime is then decided by a range and can shift under you. Either pin the dashboard *and* accept `engines` wins, or ask the owner of `package.json` to pin `"node": "22.x"`. Flagging only — `package.json` is out of scope for this document. |
| Enable access to System Environment Variables | **On** | Required for `NEXT_PUBLIC_VERCEL_URL` / `NEXT_PUBLIC_VERCEL_BRANCH_URL` to exist at all. Without it, preview origin detection silently falls back to `localhost`. |
| Deployment Protection | **Standard Protection + Vercel Authentication** | §4.2 |
| Function region | **`bom1`** | Set in `vercel.json`. Assumes the Mumbai Supabase project of §4.1 — **must match it**. |
| Fluid compute | leave alone | Default since April 2025. Nothing to configure. §4.3 |

### 4.1 Region — `bom1`, colocated with the database

The project `wwtglvbctakstnguqrzk` is in **AWS `ap-south-1` (Mumbai)**. Determined from DNS, not
assumed: `dig +short AAAA db.wwtglvbctakstnguqrzk.supabase.co` returns
`2406:da1a:82a:9d01:bb3b:d52b:d9a0:dc54`, and longest-prefix match against
`https://ip-ranges.amazonaws.com/ip-ranges.json` puts `2406:da1a::/35` in `ap-south-1`.

To re-check this for any project: resolve `db.<ref>.supabase.co` and match the prefix against that
file. Tokyo is `2406:da14::/35` and Mumbai is `2406:da1a::/35` — one hex digit apart, which is how
this gets misread. (An earlier project was in Tokyo and was recreated in Mumbai for this reason.)

**Supabase cannot move a project between regions** — there is no setting, you create a new project
and migrate into it. So if the region is ever wrong, fix it while the database is still empty:
once real users and Storage objects exist it becomes a dump/restore with downtime plus an
auth-user migration.

So the whole move is: create a project in **`ap-south-1` (Mumbai)**, then copy the new URL and keys
into `.env.local` and the Vercel env vars. After launch this becomes a dump/restore with downtime
plus an auth-user migration, so the cost only goes up.

Everything in this document that names `wwtglvbctakstnguqrzk` becomes stale the moment you do —
`.env.example` and §3's redirect allowlist included. Grep for the ref and replace it.

Then the function region must match the project. Vercel's default is `iad1` (us-east-1, Washington
D.C.). supabase-js talks HTTPS to PostgREST, so **every query is at least one round trip**, and a
cold connection costs roughly three (TCP + TLS) before the first byte:

| Function region | RTT to a Mumbai project | 1 query | 5 sequential queries |
|---|---|---|---|
| `bom1` (Mumbai) | ~1–2 ms | ~2 ms | ~10 ms |
| `iad1` (default) | ~180–200 ms | ~190 ms | **~950 ms** |
| `sin1` (Singapore) | ~50–60 ms | ~55 ms | ~275 ms |
| `hnd1` (Tokyo) | ~120–130 ms | ~125 ms | ~625 ms |

**A mismatched pair is the worst case.** `bom1` functions against the *Tokyo* project is slower than
leaving both in Tokyo. If you keep the Tokyo project for now, revert `regions` in `vercel.json` to
`["hnd1"]` — do not deploy `bom1` against it.

(Engineering estimates from typical AWS inter-region latency, not vendor-published figures.)

A page that checks auth, fetches a playlist, fetches its tracks, then resolves URLs is four
sequential round trips: ~8 ms colocated versus ~650 ms from `iad1`, of pure network with zero query
time. **This is invisible locally** — your laptop pays the same RTT to the database either way, so nothing
*changes* when you deploy; it is simply slow in a way no local test reproduces.

If the dashboard says a different region, map it via <https://vercel.com/docs/regions> and edit
`regions` in `vercel.json`. Hobby allows exactly **one** region; Pro allows five. Listing more
regions than the plan permits **fails the deployment before the build starts**.

Caveat that `regions` does not fix: **Routing Middleware is deployed to every region regardless.**
A European visitor's middleware runs in Europe and pays a Europe→Tokyo RTT on every navigation if
the middleware makes a Supabase network call. Keep middleware to cookie refresh plus a local claim
check (`getClaims()`, which verifies the JWT signature locally against the project's published
keys), and leave the authoritative `getUser()` to the `hnd1` function.

### 4.2 Deployment Protection

Set **Standard Protection** with **Vercel Authentication** (available on all plans, including
Hobby). This protects previews and generated deployment URLs while leaving the production custom
domain public — correct for a public music app whose previews contain an unfinished admin UI.

**The research reports disagreed here** — one recommended turning protection off so preview auth
redirects survive, the other recommended leaving it on. Resolved in favour of **on**, because the
conflict is narrower than it looks: for a signed-in Vercel team member the protection cookie is
already set on the preview host, so the redirect from Supabase back into `/auth/callback` sails
through and the PKCE cookie (same origin) survives the round trip. It only blocks **external
testers with no Vercel account**, who hit the SSO wall before your callback ever runs. For those,
issue a **Shareable Link** for the branch rather than disabling protection project-wide.

Two consequences to plan for:

- The **production generated URL** (`<project>-<hash>.vercel.app`) is protected too. Anything
  building absolute URLs from `VERCEL_URL` breaks for outside consumers. Use the custom domain via
  `NEXT_PUBLIC_SITE_URL` for anything an outsider will follow (OG images, email links).
- **Server-to-server POSTs receive Vercel's 401 auth-gate HTML, not your handler.** Any Supabase
  Database Webhook or Storage event hook pointed at a protected URL fails silently from the
  sender's side. Register production webhooks against the **custom domain** (unprotected under
  Standard Protection). For preview webhook testing only, generate a Protection Bypass secret
  (Settings → Deployment Protection) and append `?x-vercel-protection-bypass=<secret>` — the query
  form, because webhook senders generally cannot set custom headers. Treat that secret as a
  credential: it unlocks every deployment in the project.

### 4.3 Fluid compute

Default since 23 April 2025; nothing to enable. It changes the execution model in one way that
matters: **concurrent invocations share one Node process, one module registry, one global scope.**

- A module-level service-role client is fine and preferred — it carries no per-request identity.
- **A cookie/session-bound Supabase client at module scope is a security bug, not a caching bug.**
  A client built once from request A's cookies serves request B, so user B reads user A's rows
  under user A's RLS context. `@supabase/ssr` clients must be constructed **per request**, inside
  the handler. This is invisible locally because `next dev` handles one request at a time.
- Module-scope mutable state keyed by user (`const cache = new Map()`) has the same failure.

No `vercel.json` entry is needed. `{"fluid": true}` only pins what is already the default and adds
a thing to forget.

### 4.4 `vercel.json`

Committed at the repo root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["hnd1"],
  "functions": { "src/app/api/**/*": { "maxDuration": 30 } },
  "headers": [ /* security headers — see the file */ ]
}
```

Three things, each earning its place:

- **`regions`** — the default `iad1` is trans-Pacific from a Tokyo database (§4.1). Highest-value
  line in the file.
- **`functions.maxDuration`** — caps a hung invocation at 30 s instead of the 300 s default. No
  route in this architecture needs longer: audio never passes through a function. Note the **`src/`
  prefix is mandatory** because this project uses a `src` directory; a glob of `app/api/**/*`
  silently matches nothing. Verify it took effect in the build output's function table after the
  first deploy, and raise the number if a legitimate route ever 504s.
- **`headers`** — `next.config.ts` is the framework-native home for these and applies in `next dev`
  too, but it is outside this document's scope, so `vercel.json` is the only available place.
  Accept the divergence: these headers are **not** applied by `next dev`. Do not define the same
  header key in both files.

Deliberately absent:

- **`Content-Security-Policy`.** A correct CSP for App Router needs a per-request nonce generated
  in middleware and threaded into `script-src 'nonce-…' 'strict-dynamic'`. A static header forces
  `'unsafe-inline'`, which is a CSP that does nothing. Deferred to whoever owns `src/middleware.ts`.
  When it lands: `connect-src` must include `https://wwtglvbctakstnguqrzk.supabase.co` and
  `wss://wwtglvbctakstnguqrzk.supabase.co`, and `media-src`/`img-src` must include the Storage
  origin.
- **`Cross-Origin-Embedder-Policy`.** `require-corp` breaks `<audio>` and `<img>` loads from
  `*.supabase.co` unless every Storage response carries CORP headers.
- **`autoplay`** is explicitly `self` in `Permissions-Policy`, not denied — the player needs it.

---

## 5. Environment variables

Vercel → Project → Settings → Environment Variables.

> **Every `NEXT_PUBLIC_` variable is textually inlined into the JavaScript bundle at `next build`
> time and is public forever.** It ships inside a CDN-cached, content-hashed chunk. Anyone who has
> ever loaded the site has it. Deleting the variable in Vercel does nothing to bundles already
> served — rotating the underlying credential is the only remediation. The prefix is the *only*
> thing separating "server secret" from "printed into a public bundle", and getting it wrong fails
> **silently**: the build succeeds and the key is world-readable.

Being build-time also means values are **frozen at build**. Editing a variable in the dashboard
changes nothing until you redeploy. There is no live reload.

| Variable | Value / where to get it | Public? | Production | Preview | Development |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wwtglvbctakstnguqrzk.supabase.co` (staging ref for Preview) | **Public** — in the bundle | ✅ | ✅ | `.env.local` only |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → Project Settings → API Keys → publishable (`sb_publishable_…`) | **Public** — in the bundle, and correctly so. Maps to the `anon` role; cannot bypass RLS. Its safety is entirely a function of §2's policies being right. | ✅ | ✅ | `.env.local` only |
| `SUPABASE_SECRET_KEY` | Dashboard → API Keys → secret (`sb_secret_…`) | **SECRET** | ✅ **Sensitive** | ✅ **Sensitive**, staging key only | **not set on Vercel** |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-production-domain>` | **Public** | ✅ | ❌ **leave unset** | `http://localhost:3000` in `.env.local` |
| `DATABASE_URL` / `DIRECT_URL` | Dashboard → Settings → Database → Connection string | **SECRET** | ❌ **do not set** | ❌ | local `.env` only |

Notes that decide whether this works:

- **`NEXT_PUBLIC_SITE_URL` must be Production-scoped only.** The form pre-selects all three
  environments — that is the trap. Set it for all environments and every preview deployment
  computes the production origin, so a preview sign-in redirects the tester to production. Left
  unset in Preview, the app's origin helper falls through to `NEXT_PUBLIC_VERCEL_BRANCH_URL` (stable
  per branch, so a confirmation email sent from commit A still works after commit B deploys), then
  `NEXT_PUBLIC_VERCEL_URL`, then `localhost:3000`. That fallback chain requires **Enable access to
  System Environment Variables** (§4).
- **`DATABASE_URL` / `DIRECT_URL` belong nowhere near Vercel.** Under this architecture the running
  app opens no database connections at all — supabase-js speaks HTTP to PostgREST. These are for
  local CLI migrations only. Keeping them off Vercel removes a superuser-grade credential from the
  deployment surface entirely. This is the single highest-value line in the table.
- **`SUPABASE_SECRET_KEY` is required, not optional.** `src/lib/storage.server.ts` signs every
  playback URL with it. Without it the catalogue still renders and every `audioUrl` is null, so
  nothing plays — the one failure mode this key has that a reader would not guess.
- **Mark `SUPABASE_SECRET_KEY` Sensitive.** It runs as `service_role`, which carries `BYPASSRLS`
  plus the Auth admin API — full read/write of every row, and the ability to create, delete, or
  re-email any user. Sensitive makes the value unreadable after creation (dashboard, `vercel env
  ls`, and REST API alike) and redacts it from build logs (values ≥ 32 chars). It does **not**
  restrict scope or stop your own code logging it. Sensitive is not permitted for Development.
- **Do not mark `NEXT_PUBLIC_*` Sensitive.** It is theatre — the value is compiled into JavaScript
  you serve to the public — and it costs you the ability to verify what you configured.
- **All `NEXT_PUBLIC_*` values must exist before the first build**, not merely at runtime. A missing
  one bakes `undefined` into the bundle, and the failure surfaces only in the browser.
- Only static lookups are inlined. `process.env[name]` and `const e = process.env; e.NEXT_PUBLIC_X`
  are **not** substituted and silently become `undefined` client-side.
- Env var budget: 64 KB total per deployment, 5 KB per variable for Edge middleware.

### 5.1 Setting them by CLI

`vercel env add NAME` with **no environment argument adds it to all environments** — the same trap
as the dashboard checkboxes.

```bash
vercel env add SUPABASE_SECRET_KEY production
vercel env add SUPABASE_SECRET_KEY preview        # staging project's key
vercel env add NEXT_PUBLIC_SITE_URL production

vercel env ls preview     # AUDIT: nothing here may be a production credential
```

Run `vercel env ls preview` after every change. Marketplace/integration variables write themselves
into project settings targeting all environments, so this drifts without anyone touching it.

### 5.2 Previews must not share the production database

Point Preview at a **second, separate Supabase project** (`swaras-staging`), not at
`wwtglvbctakstnguqrzk`. If previews share production:

- Every PR branch runs unreviewed route handlers against real user rows, real audio objects, and
  real auth users. A half-finished admin delete endpoint on a feature branch deletes production
  songs. There is no undo.
- Preview builds receive the production `SUPABASE_SECRET_KEY`, which bypasses RLS entirely.
- Preview and production share one auth domain and one JWT signing key, so a session minted on a
  preview is a valid production session.
- Making auth work on previews requires `*.vercel.app` wildcards in the **production** project's
  redirect allowlist (§3) — precisely the entries you most want to avoid there.

Apply `supabase/migrations/` to staging **first**. It doubles as the rehearsal that proves the
migrations run, which matters a great deal here given they have never been applied anywhere.

Then, staging project → Authentication → URL Configuration:
Site URL `http://localhost:3000`; Redirect URLs `http://localhost:3000/**` and
`https://<project-name>-*-<team-slug>.vercel.app/**` and
`https://<project-name>-git-*-<team-slug>.vercel.app/**`.

That is what lets the **production** project keep a single exact redirect entry with no wildcards
at all — which is the whole reason the arrangement is worth the effort.

**Cost, stated honestly and needing dashboard confirmation:** the Supabase Free plan permits two
active projects, so a staging project in a **separate Free organization** costs nothing. It will
carry the free 50 MB object cap, so large-file upload testing has to happen against production.
Putting staging in the same Pro organization instead adds that project's compute to the bill.
Check Dashboard → Organization → Billing; we cannot determine your plan or project count from here.

Supabase **Branching** (a real preview branch per Git branch) is the other option. It requires a
paid plan, bills roughly $0.01344/hour per branch, and has documented races between Supabase
writing the env vars and Vercel starting the build. Not worth it for a single-developer project;
revisit if per-PR schema changes ever need review against realistic data.

---

## 6. Deploy

### 6.1 First deploy

```bash
# 0. Preconditions: §1 done, §2 migrations applied and verified, §3 auth URLs saved,
#    §4 project settings saved, §5 env vars set and `vercel env ls preview` audited.

# 1. Work is on a feature branch; origin/main is untouched. Push the branch first
#    and let it deploy as a PREVIEW. Do not make the first deploy a production deploy.
git push -u origin <your-branch>

# 2. Vercel builds it automatically. Watch the build log for:
#    - the resolved Node version
#    - "Deploying to hnd1" / the function region in the build summary
#    - no "prisma: command not found"
#    - no NEXT_PUBLIC_* value printed in plain text

# 3. Run §7 and §8 against the preview URL, end to end.

# 4. Only then merge to main. That triggers the production deploy.
git checkout main && git merge <your-branch> && git push
```

If the Vercel Git integration is not connected, `npx vercel` for a preview and
`npx vercel --prod` for production do the same thing from the CLI.

Immediately after the first production deploy, go back to §3 and replace any placeholder domain in
Site URL and Redirect URLs with the real one. **Confirmation emails bake their destination at send
time**, so a wrong value there is not fixed retroactively for links already sent.

### 6.2 Subsequent deploys

Push to a branch → preview. Merge to `main` → production. That is the whole loop.

The two things that are **not** automatic:

- **Env var changes require a redeploy.** Editing a value in the dashboard and clicking Save
  changes nothing about a running deployment, and `NEXT_PUBLIC_*` values are frozen into already-
  built bundles regardless. After any env change: Deployments → ⋯ → Redeploy.
- **New migrations require `npx supabase db push` against production**, run by a human, before the
  deploy that depends on them. Nothing in the build applies migrations. Order matters: additive
  schema changes first, then the code.

---

## 7. Post-deploy verification

Run all of it against the **preview** URL first, then the production domain. Set:

```bash
export APP=https://<preview-or-production-host>
export SB=https://wwtglvbctakstnguqrzk.supabase.co   # or the staging ref for a preview
export PK='sb_publishable_...'
```

Route paths below are what is on disk today (`/api/get-songs`, `/api/admin/delete-song`, …). The
`src/` rewrite may rename them; adjust the paths, not the assertions.

### 7.0 Getting a session cookie for curl

The app authenticates by cookie, not bearer token. Mint a session through the Auth API and encode
it the way `@supabase/ssr` does — cookie name `sb-wwtglvbctakstnguqrzk-auth-token`, value
`base64-` + base64url of the session JSON. Both facts verified against the installed
`@supabase/ssr@0.12.4` and `@supabase/supabase-js@2.112.2`, and this recipe round-trips through the
shipped decoder:

```bash
mint() {   # usage: mint email password  -> prints the Cookie header value
  local s
  s=$(curl -s -X POST "$SB/auth/v1/token?grant_type=password" \
        -H "apikey: $PK" -H 'Content-Type: application/json' \
        -d "{\"email\":\"$1\",\"password\":\"$2\"}")
  case "$s" in *access_token*) ;; *) echo "SIGN-IN FAILED: $s" >&2; return 1;; esac
  echo "sb-wwtglvbctakstnguqrzk-auth-token=base64-$(printf '%s' "$s" \
        | base64 | tr '+/' '-_' | tr -d '=\n')"
}

tok() {    # usage: tok email password  -> prints the raw access_token (for PostgREST)
  curl -s -X POST "$SB/auth/v1/token?grant_type=password" \
    -H "apikey: $PK" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p'
}
```

If the app rejects the forged cookie, the session exceeded one chunk (`MAX_CHUNK_SIZE` is 3180
bytes, measured URI-encoded) — sign in through the browser and copy the
`sb-…-auth-token` cookie value out of DevTools → Application → Cookies instead. An oversized session
is itself a finding: it means `user_metadata` is bloated, and at ~10 chunks you approach Vercel's
32 KB total-header ceiling and start getting `REQUEST_HEADER_TOO_LARGE`.

### 7.1 Sign up, sign in, sign out

```bash
# Sign up. Two accounts: an admin-to-be and a plain user.
curl -s -X POST "$SB/auth/v1/signup?redirect_to=$APP/auth/callback" \
  -H "apikey: $PK" -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"CorrectHorse1!"}' | head -c 300
# expect JSON containing "id" (and "confirmation_sent_at" if email confirmation is on)

curl -s -X POST "$SB/auth/v1/signup?redirect_to=$APP/auth/callback" \
  -H "apikey: $PK" -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"CorrectHorse2!"}' | head -c 300
```

If email confirmation is on, open both confirmation emails and confirm. **Check the link's
`redirect_to=` parameter before clicking.** If it points at `localhost:3000` or at production while
you are testing a preview, §3 is misconfigured — that is the whole failure mode, visible in the URL.

Then verify the signup trigger provisioned a `public.users` row, which also proves the `users`
SELECT policy returns exactly one row:

```bash
AT=$(tok admin@example.com 'CorrectHorse1!')
curl -s "$SB/rest/v1/users?select=id,email,role,status" \
  -H "apikey: $PK" -H "Authorization: Bearer $AT"
# expect exactly ONE row, your own, role=USER, status=ACTIVE.
# [] means handle_new_auth_user() hit ON CONFLICT DO NOTHING — an orphaned row
# from the Clerk era holds that email. Resolve it in SQL; do NOT re-point it by email.
# More than one row means the users SELECT policy is wrong.
```

Sign in and sign out through the UI in a browser. After sign-out, confirm every
`sb-wwtglvbctakstnguqrzk-auth-token*` cookie (including `.0`, `.1` chunks) is gone in DevTools →
Application → Cookies. Leftover chunks resurrect the session on the next request. Note that
sign-out must be a POST route or server action — as a GET link, any prefetch or link scanner signs
users out.

### 7.2 Promote an admin

There is no API for this. Column-level privileges deliberately prevent a user from writing their own
`role`. Dashboard → SQL Editor:

```sql
update public.users set role = 'ADMIN' where email = 'admin@example.com';
select id, email, role from public.users where email = 'admin@example.com';
```

Record that `id` — it is the app-level `users.id` (a text uuid), distinct from the `auth.users` uuid:

```bash
export ADMIN_APP_ID='<the id printed above>'
```

### 7.3 Auth callback on a preview URL

The one test that cannot be done locally.

```bash
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$APP/auth/callback?code=invalid"
# expect a 3xx redirect to an error page on THIS host — 307/302 to $APP/...
# 401 + HTML  => Vercel Deployment Protection blocked it (§4.2); sign in to Vercel in the browser.
# 404         => the callback route does not exist at this path in the current src/ rewrite.
```

Then do it for real in a browser: open the preview URL, sign in, and confirm you land back on the
**preview** host signed in. Landing on production or on `localhost` means the redirect was not
allowlisted and Supabase silently substituted Site URL (§3).

### 7.4 Browsing songs

```bash
curl -s -o /dev/null -w 'songs: %{http_code}\n' "$APP/api/get-songs?page=1&limit=5"
# expect 200

# Public playback URL serves byte ranges — required for <audio> seeking and iOS.
curl -s -o /dev/null -D - -H 'Range: bytes=0-99' \
  "$SB/storage/v1/object/public/song-audio/<songId>/v1/audio.mp3" | head -12
# expect: HTTP/2 206, accept-ranges: bytes, content-range: bytes 0-99/<size>
# Never append ?download — it sets Content-Disposition: attachment and turns playback
# into a file save.
```

### 7.5 Admin upload

Do this in the browser as the admin, with DevTools → Network open. Upload a file **larger than
10 MB**; anything smaller passes even when the architecture is wrong.

Assert, in the Network tab:

- The audio bytes go to `https://wwtglvbctakstnguqrzk.storage.supabase.co/storage/v1/upload/resumable`
  (TUS `PATCH`es, 6 MB chunks — Supabase requires exactly 6 MB), **not** to any path under `$APP`.
- Requests to `$APP/api/**` carry only JSON: a request for upload credentials, and a completion call
  registering the object path.
- No request to `$APP` has a body over ~1 MB.

If a request to `$APP` carries the file, you will see **`413 FUNCTION_PAYLOAD_TOO_LARGE`**. The
Vercel function body limit is **4.5 MB**, hard and not configurable; a Server Action taking a `File`
fails at **1 MB**; middleware caps at **4 MB** *before* the route runs. This is the highest-ranked
works-locally-breaks-in-production failure in this app, because `next dev` has no such caps.

Then confirm the row landed and the object is reachable:

```bash
curl -s "$APP/api/get-songs?page=1&limit=1" | head -c 400
```

### 7.6 Security smoke test

These close authorization holes that exist in the code on disk today. **Every one of them must
fail.** If any returns 200, do not go to production.

```bash
export UC=$(mint user@example.com 'CorrectHorse2!')     # plain user cookie
export AC=$(mint admin@example.com 'CorrectHorse1!')    # admin cookie
export UT=$(tok  user@example.com 'CorrectHorse2!')     # plain user token
export SONG_ID='<any id from /api/get-songs>'
```

**(a) A non-admin cannot delete a song by passing an admin's id.**
The handler on disk reads `{songId, userId}` from the request body and looks the role up from that
client-supplied `userId` — so anyone who knows an admin's id is an admin.

```bash
curl -s -o /dev/null -w 'non-admin delete w/ admin id: %{http_code}\n' \
  -X DELETE "$APP/api/admin/delete-song" \
  -H "Cookie: $UC" -H 'Content-Type: application/json' \
  -d "{\"songId\":\"$SONG_ID\",\"userId\":\"$ADMIN_APP_ID\"}"
# REQUIRED: 401 or 403.   200 = the hole is still open.

curl -s -o /dev/null -w 'anonymous delete: %{http_code}\n' \
  -X DELETE "$APP/api/admin/delete-song" \
  -H 'Content-Type: application/json' \
  -d "{\"songId\":\"$SONG_ID\",\"userId\":\"$ADMIN_APP_ID\"}"
# REQUIRED: 401

curl -s -o /dev/null -w 'song still exists: %{http_code}\n' \
  "$SB/rest/v1/songs?select=id&id=eq.$SONG_ID" -H "apikey: $PK"
# REQUIRED: 200 with the row still present
```

**(b) One user cannot read another user's likes or playlists.**

```bash
curl -s -o /dev/null -w 'cross-user likes via app: %{http_code}\n' \
  "$APP/api/get-liked-songs?userId=$ADMIN_APP_ID" -H "Cookie: $UC"
# REQUIRED: 401 or 403. The id must come from the session, never from a query param.

curl -s "$APP/api/get-playlist?userId=$ADMIN_APP_ID" -H "Cookie: $UC" | head -c 200
# REQUIRED: an error, or the CALLER's own playlists. Never the admin's.

# Same assertion straight through PostgREST — proves RLS is the backstop even if a
# handler forgets. This one exercises likes_owner_all / playlists_owner_all.
curl -s "$SB/rest/v1/likes?select=id,user_id&user_id=eq.$ADMIN_APP_ID" \
  -H "apikey: $PK" -H "Authorization: Bearer $UT"
# REQUIRED: []

curl -s "$SB/rest/v1/playlists?select=id,user_id" \
  -H "apikey: $PK" -H "Authorization: Bearer $UT"
# REQUIRED: only rows whose user_id is the caller's own app id

# And the upload queue: one admin must not see another admin's jobs.
curl -s "$SB/rest/v1/upload_jobs?select=id,user_id" \
  -H "apikey: $PK" -H "Authorization: Bearer $UT"
# REQUIRED: [] for a non-admin
```

**(c) No email address appears in any public response.**
The handler on disk `include`s `uploadedBy: { email }` on every song, so the catalogue endpoint
publishes admin email addresses to anonymous callers.

```bash
curl -s "$APP/api/get-songs?page=1&limit=20" | grep -Eo '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' | sort -u
# REQUIRED: no output.

curl -s "$APP/api/search?q=a" | grep -Eo '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+' | sort -u
# REQUIRED: no output.

# users is unreachable by anon at the database level regardless of handler bugs.
curl -s -o /dev/null -w 'anon users read: %{http_code}\n' \
  "$SB/rest/v1/users?select=email" -H "apikey: $PK"
# REQUIRED: 401
```

An email leak matters more than it looks here: `handle_new_auth_user()` refuses to link an auth
identity to an existing row by email precisely because *"admin email addresses have historically
been public from this app's own endpoints"*. Leaked admin emails plus any email-linking logic is an
account-takeover chain.

---

## 8. Bundle-leak audit

Proves no secret was inlined into the browser bundle. Inlining only happens during a **production**
build with **real** env values, so a plain `npm run dev` proves nothing.

```bash
cd /Users/praddeepsuthar/Documents/rahul/music-app
vercel pull --environment=production      # fetch the real production env
vercel build                              # produces .next the way Vercel does

# 1. Secret-shape sweep across everything a browser can download.
#    .next/static = JS/CSS chunks; .next/server/app/**.html and **.rsc are prerendered
#    HTML and RSC flight payloads, which are also sent to the client.
grep -rIn -E 'sb_secret_|service_role|SUPABASE_SECRET|postgres(ql)?://|SUPABASE_SERVICE_ROLE' \
  .next/static .next/server/app 2>/dev/null
# expect: no output

# 2. Exact-value check — the only test with no false negatives. Never echoes the secret.
( set -a; . ./.env.local 2>/dev/null || . ./.env; set +a
  for v in "$SUPABASE_SECRET_KEY" "$DATABASE_URL" "$DIRECT_URL"; do
    [ -n "$v" ] && grep -rIlF -- "$v" .next/static .next/server/app 2>/dev/null
  done )
# ANY output = a real leak. Rotate that credential immediately; bundles already served
# cannot be recalled.

# 3. Legacy Supabase service_role JWTs (the pre-sb_secret_ format).
grep -rIoh -E 'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}' .next/static 2>/dev/null \
  | sort -u | while read -r t; do
      echo "$t" | cut -d. -f2 | tr '_-' '/+' | base64 -D 2>/dev/null | grep -q service_role \
        && echo "LEAKED service_role JWT: ${t:0:24}..."
    done
# expect: no output

# 4. Confirm the EXPECTED publics ARE present. Catches the undefined-inlining bug,
#    where a missing Preview variable bakes `undefined` into the bundle.
grep -rIoh -E 'sb_publishable_[A-Za-z0-9_-]+' .next/static | sort -u    # expect: your key
grep -rIol 'wwtglvbctakstnguqrzk\.supabase\.co' .next/static | head     # expect: matches
```

Two notes on step 1: `.next/server/**/*.js` legitimately contains server-only secrets in its inlined
config — that code never reaches a browser, so scanning all of `.next/server` produces false
positives. Restrict to `.next/server/app`. And `-I` skips binaries so source maps and `.pack` cache
files do not garble the output.

**Wire step 2 into CI as a fail-the-build check.** It is five lines and it is the only leak control
that survives a careless refactor.

---

## 9. Troubleshooting

| Symptom (the exact text you will see) | What it actually means | Fix |
|---|---|---|
| Sign-up email link lands on `localhost:3000` or on production while testing a preview | The preview origin was not in the Redirect URLs allowlist. Supabase **does not error** on a non-allowlisted `redirectTo` — it silently substitutes Site URL, and the destination is baked into the email at send time. | §3. Add both wildcard entries with the team slug. Re-send the email; already-sent links are not retroactively fixed. |
| `invalid request: both auth code and code verifier should be non-empty`, or a PKCE error at `/auth/callback` | The code was delivered to a different host than the one holding the PKCE verifier cookie. Those cookies are host-only, and Vercel's per-commit preview host changes on every push. | Complete the flow on one host. Prefer `NEXT_PUBLIC_VERCEL_BRANCH_URL` (stable per branch) over `NEXT_PUBLIC_VERCEL_URL` when computing the origin, and derive the callback's origin from `x-forwarded-host`, not `request.url`. |
| `413 FUNCTION_PAYLOAD_TOO_LARGE` on upload | A request body exceeded **4.5 MB** (Vercel function), **1 MB** (Next Server Action), or **4 MB** (middleware, applied *before* the route). Not configurable. | Audio must never touch a function. Browser → Storage via TUS; the function issues credentials and records the path. Also check the middleware `matcher` does not cover the upload endpoint — middleware caps the body even when the route never reads it. |
| `401` + Vercel HTML on a webhook or an automated test | Deployment Protection intercepted the request before your code ran. Silent from the sender's side. | Register production webhooks against the **custom domain** (public under Standard Protection). For previews, append `?x-vercel-protection-bypass=<secret>`. |
| Sign-in works, then the user is randomly logged out mid-navigation | Refresh-token rotation raced. A refresh token is reusable only within a **10-second** interval; outside it, the whole session is **terminated**. One page load on Vercel fans out into middleware + RSC render + several route handlers in separate isolates, all holding the same refresh token. | Refresh in exactly **one** place — the middleware — and let handlers read the already-fresh cookie. Never call `getSession()` on the server. Prefer `getClaims()` in hot paths. |
| Infinite redirect loop between a page and the sign-in page | The middleware refreshed the session but returned a **freshly constructed** `NextResponse`, discarding the `Set-Cookie` headers `setAll()` wrote. The refreshed session is never persisted, so every request looks signed-out. | Return the same response object that `setAll()` mutated. |
| User B sees user A's data, intermittently, only in production | A session-bound `@supabase/ssr` client was hoisted to module scope. Under Fluid compute concurrent invocations share one process, so a client built from A's cookies serves B's request under A's RLS context. Invisible locally — `next dev` handles one request at a time. | Construct the request-bound client **inside** the handler, per request. Module scope is only safe for the service-role client. |
| An upload job polls `404` intermittently after working in testing | Job state lives in a module-level `Map`. It is per-instance; once autoscale creates a second instance, the poll lands somewhere that has never seen the job. (The legacy `UPLOAD_JOB_TTL_MINUTES` env var implies this existed.) | Job state belongs in `public.upload_jobs` / `upload_job_items`, which the schema already provides. |
| A background task silently never completes | An un-awaited promise after the response returned. The invocation is eligible for suspension the moment it responds; the promise may be frozen mid-flight forever. Always completes locally, because `next dev` is a long-lived process. | `after()` from `next/server` (present in the installed 15.5.23). It is still bounded by `maxDuration` — it is not a job queue. |
| Every page is slow (hundreds of ms) with no slow queries in Supabase | Functions are running in `iad1` against a Tokyo database. Four sequential PostgREST round trips ≈ 650 ms of pure network. | `"regions": ["hnd1"]` in `vercel.json` (already committed). Confirm the Supabase region in the dashboard. |
| `prisma: command not found` in the Vercel build log | The `build` script still starts with `prisma generate` after Prisma was removed from dependencies. Breaks **only on Vercel** — a developer with stale `node_modules` still has the binary. | `"build": "next build"` in `package.json`. Currently correct; do not let it regress. |
| Build fails: `To use "use cache", please enable the experimental feature flag "useCache"` | `'use cache'` on stable Next 15.5 needs `experimental.useCache: true`. | Don't adopt `'use cache'` for this deploy. Use `unstable_cache()` — it is the only stable way to memoize supabase-js queries, which do not go through Next's patched `fetch`. |
| Build fails: `The experimental feature "experimental.cacheComponents" can only be enabled when using the latest canary version` | `cacheComponents` / `dynamicIO` / `ppr` are canary-only; a stable build throws `CanaryOnlyError`. | Remove the flag. Route segment config + `fetch` tags + `revalidateTag` are the stable toolkit. |
| `Module not found: 'cacheLife' is not exported from 'next/cache'` | Code copied from current nextjs.org docs, which serve **v16**. On 15.5 the exports are `unstable_cacheLife` / `unstable_cacheTag`. | Use the `unstable_`-prefixed names, or don't use them at all. |
| Changing an env var in the dashboard has no effect | Env changes never apply retroactively, and `NEXT_PUBLIC_*` values are frozen into the bundle at build time. | Redeploy. Deployments → ⋯ → Redeploy. |
| `REQUEST_HEADER_TOO_LARGE` | Session cookie chunks (3180 bytes each) plus other headers exceeded Vercel's ceilings — 16 KB per header, 32 KB total, for both functions and middleware. | Keep `user_metadata` tiny (profile data belongs in `public.users`, not the JWT). Do not persist provider access tokens in the session. |
| `permission denied for table users` from PostgREST | Working as designed — `rls.sql` revokes all privileges on `public` from `anon`/`authenticated` and grants back only what is needed. Table privileges are checked **before** policies. | If a legitimately public read is blocked, add the missing `grant`, not a policy. |
| `42P17 infinite recursion detected in policy for relation "users"` | A policy on `users` whose `USING` clause selects from `users`. | Already avoided: `current_app_user_id()` and `is_admin()` are `SECURITY DEFINER` with `search_path = ''`. Never add `ALTER TABLE … FORCE ROW LEVEL SECURITY` — forcing RLS applies policies to the owner too and reintroduces the recursion. |
| Signup returns `500 Database error saving new user` | A trigger on `auth.users` raised inside GoTrue's signup transaction. | `handle_new_auth_user()` uses `ON CONFLICT DO NOTHING` specifically so it cannot. If you see this, something else was added to `auth.users`. |
| Signed in, but the app behaves as if the user does not exist | The auth identity has no `public.users` row — `handle_new_auth_user()` hit `ON CONFLICT DO NOTHING`, historically on `users_email_key`. Fail-closed by design, but it was also a lockout: anyone could squat an address at signup (no confirmation required) and permanently block its real owner. | `20260809160000_email_is_not_an_identity.sql` drops that unique index, so new signups are unaffected. An identity already stuck this way needs an operator: **never** re-point `supabase_user_id` at a row matched by email — that is an account-takeover primitive. |
| Playback re-buffers on every seek; Storage egress is huge | Signed URLs minted too often. The token is part of the CDN cache key, so a fresh URL is always a MISS pulling the whole file from origin. | `toSongDtos()` signs once per **listing** with a six-hour TTL, not per play — keep it that way. If egress is still unacceptable the remaining lever is making `song-audio` public, which trades the catalogue's access control for cache hits. |
| A flood of `HTTP 499` in Storage logs | Client aborts on seek. Normal for `<audio>`. | Ignore; exclude from error alerting. |
| Resumed TUS upload fails with 403 | `x-upsert: true` needs `SELECT` + `INSERT` + `UPDATE` on the bucket, and only some were granted. | The storage migration grants all three to admins on both buckets. If it still 403s, check `public.users.role` for the signed-in account — the policies read it live. |
| Nothing plays and every `audioUrl` is `null` | `SUPABASE_SECRET_KEY` is missing or wrong for this environment, or `20260809150000_storage.sql` was never applied so the bucket does not exist. Signing runs entirely server-side now, so a bad key takes out playback for everyone, signed in or not. | Check the variable in §5 and the migration status in §2. Anonymous playback is supported and expected — a signed-out visitor seeing no audio is a bug, not the design. |
| Storage objects with no `songs` row | The admin closed the tab between the bytes landing and `/api/upload-song/complete`. The path is recorded in `upload_job_items`. | No sweep exists yet — see §10. Reconcile by hand against `upload_jobs.expires_at`. |

---

## 10. Known gaps

Stated plainly, because each of these will otherwise be discovered at the worst moment.

**HLS / adaptive streaming has no home.** Supabase Storage performs no audio transcoding, no
transmuxing, and no HLS/DASH packaging — its only media processing is *image* transformation. This
is a straight capability loss versus Cloudinary, and it blocks the pending HLS task outright.
Building it needs an external long-running worker (ffmpeg in a container, or Mux/Transloadit)
triggered by a Storage webhook, producing an AAC ladder plus segments into a public `song-hls`
bucket. **It cannot be a Vercel function**: transcoding ~100 MB exceeds any serverless execution
budget, and nothing may continue running after the response. What ships instead is the original MP3
served with byte-range support (§7.4), which is a perfectly good v1. Treat HLS as its own project.

**Previews sharing the production database.** §5.2 prescribes a separate staging project and
explains why. Until that project exists, previews point at production, and the risk is concrete and
unbounded: unreviewed branch code holding a `BYPASSRLS` key against real rows and real audio, plus
`*.vercel.app` wildcards sitting in the production redirect allowlist. If you deploy before staging
exists, treat every preview as production access and do not merge anything with a destructive
endpoint. This is a decision to make deliberately, not to drift into.

**The public cover bucket is a deliberate security trade.** A `song-covers` object URL is a bearer
token; UUID paths give obscurity, not access control. Fine for album art already shown to anonymous
visitors — never put anything else in that bucket. (`song-audio` is private; see §1.1.)

**Signed URLs cannot be revoked.** RLS is checked when a signed URL is minted, not when it is used.
Demoting an admin does not invalidate URLs they already hold, and there is no revocation API. TTL is
the only lever, and this app sets it to six hours (`AUDIO_URL_TTL_SECONDS`) because a token that dies
mid-session breaks the next seek. That is a deliberate choice of usability over revocation latency: a
demoted or suspended user keeps whatever playback URLs they already fetched, for up to six hours.
Shorten it if that matters more than seeking.

**Access tokens outlive sign-out.** Revoked sessions' access tokens stay valid until their `exp`
claim — up to an hour with the default JWT lifetime. With `getClaims()` verifying locally, a
signed-out user's token keeps validating for that window. Genuinely sensitive routes need
`getUser()` (a network call to the Auth server) and must accept the latency.

**Session cookies are readable by JavaScript.** `@supabase/ssr` sets `httpOnly: false` by design so
the browser client can read `document.cookie`. An XSS therefore reads the session. Setting
`httpOnly: true` breaks the browser client. It also sets no `Secure` flag by default — harmless on
Vercel, which is HTTPS-only, but pass it via `cookieOptions` if you want it explicit.

**Middleware is not an authorization boundary.** Per Next.js docs, `_next/data` routes are invoked
even when excluded by a negative matcher, and Server Functions are not separate routes in the
matcher chain. Every route handler and server action must re-check auth independently. RLS is the
backstop; every `where` clause must be written as though RLS does not exist.

**`.env.example` no longer lists Clerk or Cloudinary variables** — both are gone from the codebase,
along with the `cloudinary` / `next-cloudinary` dependencies and every API secret they needed. The
file now lists only the two `NEXT_PUBLIC_SUPABASE_*` values, `SUPABASE_SECRET_KEY` and
`NEXT_PUBLIC_SITE_URL`. §5 is still the authoritative list for the deploy.

**Route paths in §7 reflect the code on disk today**, which is mid-rewrite and still Clerk/Prisma
based. The security assertions in §7.6 are exactly the holes that rewrite must close; verify them
against whatever the final paths are.

### Things we could not determine without dashboard access

Look these up yourself; each is a few seconds and each can invalidate a decision above.

1. **Supabase project region** — Dashboard → Project Settings → General → Region. Drives
   `regions` in `vercel.json`. Inferred as `ap-northeast-1` from DNS (§4.1); confirm.
2. **Supabase plan** — Dashboard → Organization → Billing. Free caps Storage objects at 50 MB,
   which rejects a ~100 MB master outright.
3. **Vercel plan, team slug, and project name** — Settings → General. The slug and project name go
   verbatim into the redirect allowlist (§3); a wrong slug means every preview login fails.
4. **Whether the Supabase Vercel integration still auto-syncs redirect URLs.** A 2023 Supabase blog
   post says it does; the current branching-integrations doc does not mention it. **Do not plan
   around it** — configure the wildcards manually as in §3.
5. **Whether Vercel bills Node-runtime middleware as a function invocation.** Unverified. It does
   not affect this deploy: middleware stays on Edge, since `@supabase/ssr` needs nothing Node-only
   (PKCE uses Web Crypto, transport is `fetch`; no Node built-in imports exist in the installed
   packages). Do **not** add `export const runtime = 'nodejs'` — Next.js 16 renames
   `middleware.ts` → `proxy.ts`, where that option throws.
6. **Current Edge middleware bundle-size limit.** Unverified numeric ceiling. Keep the middleware
   import graph tiny regardless: never import the service-role client, `realtime-js`, or anything
   pulling in `fs`/`node:crypto`.
7. **Vercel's branch-name → hostname sanitisation for names containing `.`** — affects whether the
   `*` wildcard matches (§3).
