# Deploying Swaras to Vercel

Takes this repo from "never deployed" to "running on Vercel against Supabase". §0 is the
start-to-finish checklist; every later section is the reasoning behind one of its steps.

Project ref throughout: **`wwtglvbctakstnguqrzk`**, API URL
`https://wwtglvbctakstnguqrzk.supabase.co`, region **AWS `ap-south-1` (Mumbai)**.

Shell variables used by the commands in this guide:

```bash
export REF=wwtglvbctakstnguqrzk
export SB=https://$REF.supabase.co
export PK='sb_publishable_...'          # NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
export SITE=https://<your-production-domain>
```

---

## 0. The deployment checklist

Follow top to bottom. Steps marked **[dashboard]** cannot be done from this repo and are the ones
that actually decide whether auth works in production. Nothing here is destructive until step 14.

### A — Confirm the repo is deploy-ready (local, ~2 minutes)

1. **`npm ci && npm run type-check && npm run lint && npm run build`.** A clean local production
   build is the cheapest way to find a Vercel build failure. `build` is exactly `next build` — no
   codegen step, no `prisma generate`, nothing that needs a database. If the build needs
   `NEXT_PUBLIC_SUPABASE_URL` to be present (it does — `next.config.ts` derives the allowed image
   host from it at build time), `.env.local` supplies it locally and Vercel's env vars supply it
   there.
2. **Confirm `vercel.json` is right for the target project.** `regions` must be `["bom1"]` to match
   the Mumbai Supabase project (§4.1), and the `functions` glob must keep its `src/` prefix (§4.4).
   Both are correct as committed.
3. **Decide the production domain now.** Steps 5 and 11 both bake it in, and confirmation emails
   freeze their destination at send time — a wrong value is not fixable retroactively for links
   already sent.

### B — Supabase dashboard (the part the repo cannot do) **[dashboard]**

4. **Check the plan.** Organization → Billing. **Free caps every Storage object at 50 MB**, hard and
   unraisable, so a ~100 MB master is rejected outright while the `song-audio` bucket happily
   advertises a 100 MB limit. We cannot read your tier from the API — look it up. If you are on
   Free and only ever upload files under 50 MB, Free is fine.
5. **Set the Site URL.** Authentication → URL Configuration → Site URL. Exactly one value, no
   wildcard, no trailing slash:

   ```
   https://<your-production-domain>
   ```

   This is both the default redirect target *and* the **silent fallback** when a supplied
   `redirectTo` fails the allowlist. Leaving it at `http://localhost:3000` is how production
   confirmation emails end up pointing at a laptop.
6. **Set the Redirect URL allowlist.** Same page, one entry per line. These exact five:

   ```
   http://localhost:3000/**
   https://<your-production-domain>/**
   https://<project-name>-*-<vercel-team-slug>.vercel.app/**
   https://<project-name>-git-*-<vercel-team-slug>.vercel.app/**
   https://<project-name>.vercel.app/**
   ```

   - `<vercel-team-slug>` is the **slug** of the team or personal account (Vercel → Settings →
     General), not its display name. `<project-name>` is the Vercel project name. Both appear
     verbatim in every preview hostname — if unsure, do step 15 first and copy them out of the URL.
   - The last entry is the project's *stable* production alias, which Vercel creates alongside your
     custom domain. Omit it and any sign-up completed on that hostname silently redirects elsewhere.
   - Read §3 before deviating. Two entries that look reasonable and are **not** safe:
     `https://**-<slug>.vercel.app/**` (leading `**` crosses `/`, so an attacker's host satisfies it)
     and `https://*.vercel.app/**` (hands your auth codes to anyone's deployment on `vercel.app`).
   - The app derives its redirect from `window.location.origin` (`SignUpForm.tsx`), so **every host
     a tester might sign up on must be listed** — there is no env var that pins it.
7. **Decide email delivery.** Confirmation is currently **ON** (verified live:
   `GET /auth/v1/settings` returns `mailer_autoconfirm: false`), and the project is on Supabase's
   **built-in SMTP**, which is explicitly not for production — it is rate-limited to a handful of
   messages per hour, shared, and drops mail to addresses outside your organisation. Pick one:

   | Option | Where | Consequence |
   |---|---|---|
   | **Custom SMTP** (recommended) | Authentication → Emails → SMTP Settings. Resend / Postmark / SES. | Real deliverability and your own rate limit. Costs a DNS setup (SPF/DKIM on the sending domain) before the first send. Do this *before* announcing the URL, not after users start bouncing. |
   | **Turn confirmation off** | Authentication → Providers → Email → "Confirm email" off | Sign-up becomes instant and no email is sent at all, which removes the whole class of redirect bugs. The cost is real: anyone can register any address they do not own. Acceptable for a demo, not for anything with a password reset flow — reset still needs working email. |
   | **Leave built-in SMTP on** | — | Works for you and a couple of testers, then silently rate-limits. Do not launch on it. |

   Whichever you pick, `handle_new_auth_user()` provisions the `public.users` row from a trigger on
   `auth.users`, so confirmed or not, the profile row appears at sign-up.
8. **Confirm the email provider is enabled.** Authentication → Providers → Email. Verified live as
   enabled, with sign-ups open. No OAuth provider is enabled and the UI offers none, so there is
   nothing to configure with Google or anyone else.
9. **Schema and Storage: nothing to do.** All 7 migrations are applied and both buckets exist (§2).
   Re-running `npm run db:push` is a no-op. Skip to step 10.

### C — Vercel project **[dashboard]**

10. **Import the repo** at vercel.com → Add New → Project. Framework preset **Next.js**
    (auto-detected), root directory the repo root, build and install commands left **unset**. Set
    **Node.js version 22.x** — but note `package.json` declares `"engines": { "node": ">=20" }`,
    which *overrides* the dashboard and resolves to the latest major (§4).
11. **Add the environment variables**, per scope. Exactly four; the app reads no others
    (`grep -rn 'process\.env' src/` confirms it):

    | Variable | Production | Preview | Development | Prefix rule |
    |---|---|---|---|---|
    | `NEXT_PUBLIC_SUPABASE_URL` | ✅ | ✅ | `.env.local` only | `NEXT_PUBLIC_` is **required** — the browser client reads it |
    | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ | ✅ | `.env.local` only | `NEXT_PUBLIC_` is **required**, and safe: it maps to `anon` and cannot bypass RLS |
    | `SUPABASE_SECRET_KEY` | ✅ mark **Sensitive** | ✅ mark **Sensitive** | **not on Vercel** | **must never carry `NEXT_PUBLIC_`.** It runs as `service_role` with `BYPASSRLS` and the Auth admin API. Prefixing it publishes full database control in a CDN-cached JS chunk, and the build still succeeds |
    | `NEXT_PUBLIC_SITE_URL` | ✅ | ❌ leave unset | `http://localhost:3000` | `NEXT_PUBLIC_` required; Production scope **only** |

    `DATABASE_URL` / `DIRECT_URL` go **nowhere near Vercel** — the running app opens no database
    connections at all. See §5 for why each of these is scoped the way it is.
12. **Enable "Automatically expose System Environment Variables"** (Settings → Environment
    Variables). Nothing in `src/` reads `VERCEL_URL` today, so this is not load-bearing — turn it on
    anyway so the build log identifies itself and so the fallback described in §5 becomes available
    if anyone adds it.
13. **Set Deployment Protection** to Standard Protection + Vercel Authentication (§4.2). Previews
    contain an unfinished admin UI; production on the custom domain stays public.

### D — Deploy and verify

14. **Push a branch and let it deploy as a preview first.** `git push -u origin <branch>`. Do not
    make the first deploy a production deploy.
15. **Copy the real preview hostname out of the URL and go back to step 6** if you guessed the team
    slug or project name. This is the moment to correct it.
16. **Verify on the preview**, in this order (§7 has the commands):
    a. `GET $APP/api/get-songs?page=1&limit=5` returns 200.
    b. Sign up in a browser on the **preview host**. Before clicking the confirmation link, look at
       its `redirect_to=` parameter — if it points at localhost or production, step 6 is wrong, and
       that is the only place the failure is visible.
    c. Land back on the **preview** host, signed in.
    d. Run the §7.6 authorization assertions. Every one must fail closed.
    e. Upload a file larger than 10 MB as an admin with DevTools open; assert the bytes go to
       `*.storage.supabase.co`, never to `$APP` (§7.5).
17. **Run the bundle-leak audit (§8)** against a real production build. Five lines, and the only
    check that catches a `NEXT_PUBLIC_`-prefixed secret.
18. **Merge to `main`** → production deploy. Then re-check step 5's Site URL against the real
    production domain, and repeat 16b–16c on it.
19. **After any env var change, redeploy.** `NEXT_PUBLIC_*` values are frozen into the bundle at
    build time; editing them in the dashboard changes nothing about a running deployment.

Ongoing: new migrations are applied by a human with `npm run db:push` **before** the deploy that
needs them. Nothing in the build applies migrations.

---

## 1. Prerequisites

Everything here must be true before the first deploy. None of it is created by the deploy.

"Verified live" below means checked against `https://wwtglvbctakstnguqrzk.supabase.co` with the keys
in `.env.local` — not inferred from this repo, and not taken on trust from an earlier draft of this
document.

| # | Thing | State today | How to satisfy it |
|---|---|---|---|
| 1 | Supabase project exists | ✅ `wwtglvbctakstnguqrzk`, `ap-south-1` (Mumbai) | — |
| 2 | Supabase plan | ❓ **cannot be determined from the API** — needs Dashboard → Organization → Billing | Free caps every Storage object at **50 MB**, hard and unraisable, regardless of the 100 MB `file_size_limit` on `song-audio`. A ~100 MB master is rejected outright on Free. |
| 3 | Database schema applied | ✅ **all 7 migrations applied** (§2) | — |
| 4 | Storage buckets exist | ✅ verified live: `song-audio` (private, 100 MB) and `song-covers` (public, 10 MB), with the exact MIME allowlists below | — |
| 5 | Storage RLS policies | ✅ created by the same migration, which is applied | — |
| 6 | Email auth provider enabled | ✅ verified live — `GET /auth/v1/settings` returns `external.email: true`, `disable_signup: false` | — |
| 7 | An ADMIN user exists | ✅ verified live — one user, `role=ADMIN`, `status=ACTIVE` | §7.2 is still the procedure for creating another; there is no API path |
| 8 | Email confirmation decided | ⚠️ **on** (`mailer_autoconfirm: false`), delivered by Supabase's built-in SMTP | §0 step 7 — built-in SMTP is not for production |
| 9 | Vercel account + team slug known | ❓ | §3 and §0 step 6 need the slug verbatim |
| 10 | Production domain decided | ❓ | Needed before §3 and §4. Do not defer — the Supabase Site URL is baked into every confirmation email at send time. |

The catalogue is currently **empty** (0 rows in `songs`), so a freshly deployed site showing nothing
on `/` is correct, not a bug. §7.5 is what fills it.

Local tooling: Node ≥ 20 and `npx supabase` (resolves in this repo already — no global install
needed). There is **no Supabase CLI login on this machine** and `supabase/` contains only
`migrations/` (no `config.toml`, no link), so §2 would start with `npx supabase login` — but §2 is
already done and you do not need it for this deploy.

### 1.1 Storage buckets

`supabase/migrations/20260809150000_storage.sql` creates the buckets and their policies, and **it is
applied** — both buckets are live with exactly the configuration below, confirmed by
`GET /storage/v1/bucket`. There is nothing to create by hand.

There are **two** buckets, not three: `uploads-staging` was never built, because TUS writes straight
to the destination object and a staging hop would only double the bytes stored and add a copy step.

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

### 1.2 Auth providers and email delivery

Verified live from `GET $SB/auth/v1/settings` (a public endpoint — the publishable key is enough):

```json
{ "external": { "email": true, "google": false, ...all others false },
  "disable_signup": false, "mailer_autoconfirm": false }
```

- **Email**: enabled, sign-ups open, **confirmation required**. With confirmation on, §7.1 requires
  reading a real inbox, and the confirmation link's destination is frozen at send time by §3.
- **No OAuth provider is enabled**, and the sign-in/sign-up UI offers none — there is no
  `signInWithOAuth` call anywhere in `src/`. Nothing to configure. If Google is ever added, the
  callback you register with Google is the fixed Supabase URL
  `https://wwtglvbctakstnguqrzk.supabase.co/auth/v1/callback` — **not** a Vercel URL — so preview
  deployments would need no Google config changes; only the Supabase redirect allowlist in §3
  matters for previews.

**What `GET /auth/v1/settings` does not tell you, and the dashboard must:** whether custom SMTP is
configured. Assume it is not until you have looked. Supabase's built-in SMTP is a shared, heavily
rate-limited service (a handful of messages per hour) that Supabase documents as unsuitable for
production and which will not reliably deliver to addresses outside your organisation. §0 step 7
lays out the three options and what each costs. The failure mode is quiet: sign-up returns 200 with
`confirmation_sent_at` set, and the mail simply never arrives.

---

## 2. Applying the database schema

**Status: all 7 applied. Nothing to do for this deploy.** `supabase/migrations/` contains exactly
seven files (`ls supabase/migrations/*.sql | wc -l` → 7) and all seven are applied to
`wwtglvbctakstnguqrzk` (Mumbai). They were pushed with `npx supabase db push --db-url ...`, which
does not require `supabase login`, and are recorded in `supabase_migrations.schema_migrations`, so
`npm run db:push` is now a no-op:

| # | Migration | Applied — evidence |
|---|---|---|
| 1 | `20260809130000_init_schema.sql` | ✅ **verified live** — all 13 tables answer through PostgREST (`songs`, `users`, `artists`, `albums`, `movies`, `song_credits`, `album_artists`, `playlists`, `playlist_songs`, `likes`, `upload_jobs`, `upload_job_items`, `webhook_events`) |
| 2 | `20260809130100_rls.sql` | ✅ **verified live** — `songs` is 200 to anon; `users`, `likes`, `playlists`, `upload_jobs`, `upload_job_items`, `webhook_events` are all **401** to anon; the `is_admin` and `current_app_user_id` helper functions are exposed |
| 3 | `20260809130200_provision_app_user.sql` | ✅ **verified indirectly** — the project has one `auth.users` row and exactly one matching `public.users` row, which only `handle_new_auth_user()` creates |
| 4 | `20260809140000_song_like_counts.sql` | ✅ **verified live** — `POST /rest/v1/rpc/song_like_counts` returns 200 to anon |
| 5 | `20260809150000_storage.sql` | ✅ **verified live** — both buckets exist with the exact limits and MIME allowlists of §1.1, and `songs` / `upload_job_items` no longer carry the `audio_url` / `cover_url` columns this migration drops |
| 6 | `20260809160000_email_is_not_an_identity.sql` | ⚠️ **reported applied; not independently verifiable from here.** It drops the `users_email_key` index, and index existence has no REST-observable surface. Confirm in the SQL editor if it matters: `select indexname from pg_indexes where tablename = 'users';` — `users_email_key` must be **absent** |
| 7 | `20260809160100_upload_job_items_column_grants.sql` | ⚠️ **reported applied; not independently verifiable from here.** Column-level grants are invisible to PostgREST. Confirm with `select column_name, privilege_type from information_schema.column_privileges where table_name = 'upload_job_items' and grantee = 'authenticated' and privilege_type = 'UPDATE';` — expect exactly `upload_session_id, uploaded_bytes, status, error_code, signed_at, song_id, completed_at` |

Migrations 6 and 7 are the two whose absence is silent and dangerous — 6 lets a stranger's signup
permanently lock a real user out of ever getting a profile row; 7 lets an admin rewrite
`audio_path` from the browser and register a song for an object they never uploaded. Both are
30-second SQL-editor checks. Run them once and move on.

The rest of this section is the reference for a fresh environment (a staging project, §5.2).

Read the header comment in `20260809130000_init_schema.sql` before running anything. Every
statement is `IF NOT EXISTS`-guarded, which makes re-running harmless but **does not** make it
correct against a database that already carries the old Prisma-era tables: `CREATE TABLE IF NOT
EXISTS` silently does nothing when the table exists, so an old `users` would keep
`vendor_id`/`vendor_name` and never gain `supabase_user_id`. Confirm a **new** target database has
no `public.users` before you start. (Against `wwtglvbctakstnguqrzk` this now returns 401, which is
the correct answer for an already-migrated project — the check below is for fresh environments
only.)

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
https://<your-production-domain>/**
https://<project-name>-*-<vercel-team-slug>.vercel.app/**
https://<project-name>-git-*-<vercel-team-slug>.vercel.app/**
https://<project-name>.vercel.app/**
```

`<vercel-team-slug>` is the **slug** of the Vercel team or personal account, not its display name —
Vercel → Settings → General. `<project-name>` is the Vercel project name. Both appear in any
preview hostname; deploy once and copy them out of the URL if unsure.

Three notes on that list, each of which has burned someone:

- **There is exactly one auth route in this app: `GET /auth/callback`** (`src/app/auth/callback/route.ts`).
  There is no `/auth/confirm` — an earlier draft of this document listed one, and an allowlist entry
  for a route that does not exist is dead weight that also hides the missing real entry. The `/**`
  suffix covers `/auth/callback` and anything the app adds later, which is why the production entry
  is written as a prefix rather than pinned to the callback path.
- **The production `*.vercel.app` alias needs its own entry.** Vercel keeps
  `<project-name>.vercel.app` pointing at production even after you attach a custom domain, and a
  sign-up completed there is a sign-up whose `redirectTo` is that hostname.
- **The origin is computed in the browser, not from an env var.** `SignUpForm.tsx` passes
  `emailRedirectTo: ${window.location.origin}/auth/callback`, and `/auth/callback` redirects to
  `new URL(request.url).origin`. Nothing reads `NEXT_PUBLIC_SITE_URL` or `VERCEL_URL` for this. So
  the allowlist is the *only* control on where confirmation links land, and every host a human might
  sign up on must appear in it.

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
| Build command | *unset* (uses `package.json` `build`) | Verified: `"build": "next build"`, nothing more. Prisma is gone from the repo entirely — no `prisma/` directory, no `prisma.config.ts`, no `prisma` dependency, and no `db:migrate` / `db:generate` scripts. The only database scripts are `db:push` and `db:types`, and **neither runs during the build**. If anyone re-adds a `prisma generate` prefix, **the build fails on Vercel only**, because a developer with stale `node_modules` still has the binary locally. |
| Install command | *unset* | Auto-detected from `package-lock.json` → `npm install`. |
| Node.js version | **22.x** — set it explicitly | `package.json` declares `"engines": { "node": ">=20" }`, and `engines` **overrides** the dashboard. Per Vercel's mapping an open-ended `>=20` range resolves to the newest major Vercel offers, not 20. That works with Next 15.5 / React 19, but the deployed runtime is then decided by a range and can shift under you. Either pin the dashboard *and* accept `engines` wins, or ask the owner of `package.json` to pin `"node": "22.x"`. Flagging only — `package.json` is out of scope for this document. |
| Enable access to System Environment Variables | **On** | Not load-bearing today: `grep -rn 'process\.env' src/` finds no reference to `VERCEL_URL`, `NEXT_PUBLIC_VERCEL_URL` or `NEXT_PUBLIC_VERCEL_BRANCH_URL`. The app derives its origin in the browser from `window.location.origin`. Turn it on anyway — it costs nothing and it is the prerequisite for the fallback chain in §5 if anyone ever adds one. |
| Deployment Protection | **Standard Protection + Vercel Authentication** | §4.2 |
| Function region | **`bom1`** | Set in `vercel.json`, and it matches: the project is in Mumbai (§4.1). Nothing to do in the dashboard. |
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
and migrate into it. That move has already happened: an earlier project was in Tokyo and was
recreated in Mumbai as `wwtglvbctakstnguqrzk`, which is why `vercel.json` says `bom1` and not
`hnd1`. **This is settled; do not redo it.** If a future move is ever needed, do it while the
database is still empty — once real users and Storage objects exist it becomes a dump/restore with
downtime plus an auth-user migration. Everything in this document that names
`wwtglvbctakstnguqrzk` would become stale, `.env.example` and §3's redirect allowlist included;
grep for the ref and replace it.

The function region must match the project. Vercel's default is `iad1` (us-east-1, Washington
D.C.). supabase-js talks HTTPS to PostgREST, so **every query is at least one round trip**, and a
cold connection costs roughly three (TCP + TLS) before the first byte:

| Function region | RTT to a Mumbai project | 1 query | 5 sequential queries |
|---|---|---|---|
| `bom1` (Mumbai) | ~1–2 ms | ~2 ms | ~10 ms |
| `iad1` (default) | ~180–200 ms | ~190 ms | **~950 ms** |
| `sin1` (Singapore) | ~50–60 ms | ~55 ms | ~275 ms |
| `hnd1` (Tokyo) | ~120–130 ms | ~125 ms | ~625 ms |

**A mismatched pair is the worst case** — `bom1` functions against a Tokyo database is slower than
leaving both in Tokyo. The pair is currently matched (`bom1` ↔ Mumbai); the only way to break it is
to change one without the other.

(Engineering estimates from typical AWS inter-region latency, not vendor-published figures.)

A page that checks auth, fetches a playlist, fetches its tracks, then resolves URLs is four
sequential round trips: ~8 ms colocated versus ~650 ms from `iad1`, of pure network with zero query
time. **This is invisible locally** — your laptop pays the same RTT to the database either way, so nothing
*changes* when you deploy; it is simply slow in a way no local test reproduces.

If the dashboard says a different region, map it via <https://vercel.com/docs/regions> and edit
`regions` in `vercel.json`. Hobby allows exactly **one** region; Pro allows five. Listing more
regions than the plan permits **fails the deployment before the build starts**.

Caveat that `regions` does not fix: **Routing Middleware is deployed to every region regardless.**
A European visitor's middleware runs in Europe and pays a Europe→Mumbai RTT on every navigation if
the middleware makes a Supabase network call. Keep middleware to cookie refresh plus a local claim
check (`getClaims()`, which verifies the JWT signature locally against the project's published
keys), and leave the authoritative `getUser()` to the `bom1` function.

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
  "regions": ["bom1"],
  "functions": { "src/app/api/**/*": { "maxDuration": 30 } },
  "headers": [ /* security headers — see the file */ ]
}
```

Three things, each earning its place:

- **`regions`** — `["bom1"]`, colocated with the Mumbai project. The default `iad1` would be a
  ~190 ms round trip per query (§4.1). Highest-value line in the file. Hobby allows exactly **one**
  region; listing more than the plan permits fails the deployment before the build starts.
- **`functions.maxDuration`** — caps a hung invocation at 30 s, well under the platform default. No
  route in this architecture needs longer: audio never passes through a function.

  **The glob is correct — checked, not assumed.** A `functions` pattern that matches nothing does
  not error; it silently no-ops, and you find out when a route 504s at the default limit. Verified
  with the `minimatch` already in `node_modules`, against the real file list:

  | Path | Matches `src/app/api/**/*` |
  |---|---|
  | `src/app/api/check-admin/route.ts` | ✅ |
  | `src/app/api/playlists/[playlistId]/route.ts` | ✅ (bracketed dynamic segments are not glob syntax here) |
  | `src/app/api/upload-song/complete/route.ts` | ✅ |
  | `src/app/auth/callback/route.ts` | ❌ — **not covered** |
  | `src/middleware.ts` | ❌ (correct; middleware has no `maxDuration`) |

  All **13** route handlers under `src/app/api/**` match. The **`src/` prefix is mandatory** because
  this project uses a `src` directory — a glob of `app/api/**/*` matches nothing at all.

  The one uncovered function is `src/app/auth/callback/route.ts`, the OAuth/confirmation code
  exchange, which runs at the platform default instead of 30 s. Left alone deliberately: it is a
  single `exchangeCodeForSession` call and broadening the glob to `src/app/**/*` would sweep in
  every `page.tsx` as well. If you ever want it covered, add a second explicit key
  `"src/app/auth/**/*"` rather than widening this one.

  Confirm it took effect in the build output's function table after the first deploy, and raise the
  number if a legitimate route ever 504s.
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

**This table is the complete list.** `grep -rn 'process\.env' src/` reads exactly four variables
plus `NODE_ENV`, and `next.config.ts` reads one more (the same `NEXT_PUBLIC_SUPABASE_URL`). Nothing
else — no `VERCEL_URL`, no `UPLOAD_JOB_TTL_MINUTES`, no Clerk or Cloudinary leftovers.

| Variable | Value / where to get it | Public? | Production | Preview | Development |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://wwtglvbctakstnguqrzk.supabase.co` (staging ref for Preview) | **Public** — in the bundle | ✅ | ✅ | `.env.local` only |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → Project Settings → API Keys → publishable (`sb_publishable_…`) | **Public** — in the bundle, and correctly so. Maps to the `anon` role; cannot bypass RLS. Its safety is entirely a function of §2's policies being right. | ✅ | ✅ | `.env.local` only |
| `SUPABASE_SECRET_KEY` | Dashboard → API Keys → secret (`sb_secret_…`) | **SECRET** | ✅ **Sensitive** | ✅ **Sensitive**, staging key only | **not set on Vercel** |
| `NEXT_PUBLIC_SITE_URL` | `https://<your-production-domain>` | **Public** | ✅ | ❌ **leave unset** | `http://localhost:3000` in `.env.local` |
| `DATABASE_URL` / `DIRECT_URL` | Dashboard → Settings → Database → Connection string | **SECRET** | ❌ **do not set** | ❌ | local `.env` only |

Notes that decide whether this works:

- **`NEXT_PUBLIC_SITE_URL` must be Production-scoped only, and it does less than its name suggests.**
  Today it has exactly one reader: `src/app/layout.tsx` uses it as Next's `metadataBase`, so Open
  Graph and canonical URLs resolve absolutely. It falls back to `'http://localhost:3000'` when
  unset, which is harmless on a preview (wrong OG URLs on a throwaway host) and wrong on production
  (OG images that point at localhost). **It is not used for auth redirects** — `SignUpForm.tsx`
  passes `window.location.origin` and `/auth/callback` redirects to `new URL(request.url).origin`,
  so §3's allowlist is the only thing that governs where a confirmation link lands.

  Set it for all three environments — the form pre-selects all three, and that is the trap — and
  every preview's metadata claims the production origin. There is no env-based fallback chain in
  this codebase: the previous version of this document described one through
  `NEXT_PUBLIC_VERCEL_BRANCH_URL` → `NEXT_PUBLIC_VERCEL_URL` → `localhost`, and **no such helper
  exists**. If you add one (a good idea — a per-branch stable origin means a confirmation email sent
  from commit A still works after commit B deploys), it needs **Enable access to System Environment
  Variables** (§4) to have anything to read.
- **`NEXT_PUBLIC_SUPABASE_URL` is needed at build time, not just runtime.** `next.config.ts` derives
  `images.remotePatterns` from it. Absent at build, the list is empty and the optimizer **refuses
  every remote image** — every cover in the app breaks, and the build itself succeeds. That is the
  intended failure (an unconfigured build should not proxy arbitrary hosts), but it means a missing
  Preview value shows up as a wall of broken album art rather than an error.
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

Apply `supabase/migrations/` to staging with `npm run db:push`. All seven have now run cleanly
against production (§2), so this is a replay of a known-good sequence rather than a first attempt.

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

The code is already on `origin/main` (`eba7839`, `github.com/sutharrahul/swaras-music-app`), so
importing the repo into Vercel will immediately build `main` as **production**. If you want a
preview first — you do — create the Vercel project with the Git integration but make your next
change on a branch, or run the CLI preview build explicitly.

```bash
# 0. Preconditions: §0 A–C complete — §1 verified, §2 already applied, §3 auth URLs saved,
#    §4 project settings saved, §5 env vars set and `vercel env ls preview` audited.

# 1. Preview first, from the CLI — this does not touch main.
npx vercel                            # builds and deploys a PREVIEW, prints its URL

#    Or, with the Git integration: push a branch and let it deploy as a preview.
git push -u origin <your-branch>

# 2. Watch the build log for:
#    - the resolved Node version
#    - "bom1" / the function region in the build summary
#    - the function table listing all 13 src/app/api routes at maxDuration 30 (§4.4)
#    - no "prisma: command not found" (Prisma is gone; this should be impossible)
#    - no NEXT_PUBLIC_* value printed in plain text

# 3. Run §7 and §8 against the preview URL, end to end.

# 4. Only then promote. Merge to main (production deploy), or:
npx vercel --prod
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

Route paths below are what is on disk today. The full set, verified by
`find src/app -name route.ts`, is thirteen handlers under `src/app/api/**` plus `GET /auth/callback`:

| Route | Methods |
|---|---|
| `/api/get-songs`, `/api/search`, `/api/check-admin`, `/api/get-liked-songs` | `GET` |
| `/api/playlists` | `GET`, `POST` |
| `/api/playlists/[playlistId]` | `GET`, `DELETE` |
| `/api/like-song` | `POST`, `DELETE` |
| `/api/post-playlist`, `/api/upload-song`, `/api/upload-song/complete` | `POST` |
| `/api/admin/delete-song`, `/api/delete-playlist`, `/api/remove-playlist-song` | `DELETE` |
| `/auth/callback` | `GET` |

**There is no `/api/get-playlist`** — an earlier draft of this document asserted one. A single
playlist is `GET /api/playlists/[playlistId]`, and it takes the playlist id from the path and the
caller from the session. Adjust paths if `src/` moves them; the assertions are what matter.

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
# [] means handle_new_auth_user() hit `on conflict do nothing`. Since
# 20260809160000 dropped users_email_key that can no longer be an email collision;
# it would be the pkey or the supabase_user_id unique index. Resolve it in SQL, and
# NEVER re-point supabase_user_id at a row matched by email — that is account takeover.
# More than one row means the users SELECT policy is wrong.
```

Sign in and sign out through the UI in a browser. After sign-out, confirm every
`sb-wwtglvbctakstnguqrzk-auth-token*` cookie (including `.0`, `.1` chunks) is gone in DevTools →
Application → Cookies. Leftover chunks resurrect the session on the next request. Sign-out is
currently a client-side `supabase.auth.signOut()` on a button in `UserMenu.tsx`, which is fine. If
it is ever moved server-side, make it a POST route or server action — as a GET link, any prefetch or
link scanner signs users out.

### 7.2 Promote an admin

**One ADMIN already exists** on `wwtglvbctakstnguqrzk` (verified: one user row, `role=ADMIN`,
`status=ACTIVE`), so this is only needed for a fresh environment or a second admin.

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
# expect 200. The catalogue starts EMPTY (0 rows), so `items: []` is the correct
# first answer — run §7.5 before expecting anything here.

# `song-audio` is PRIVATE. There is no public object URL for audio; take the signed
# one out of the response above rather than constructing a path.
AUDIO=$(curl -s "$APP/api/get-songs?page=1&limit=1" \
  | sed -n 's/.*"audioUrl":"\([^"]*\)".*/\1/p')
echo "$AUDIO" | grep -q 'token=' || echo 'NO SIGNED URL — check SUPABASE_SECRET_KEY (§5)'

# Byte ranges must work on the signed URL — required for <audio> seeking and iOS.
curl -s -o /dev/null -D - -H 'Range: bytes=0-99' "$AUDIO" | head -12
# expect: HTTP/2 206, accept-ranges: bytes, content-range: bytes 0-99/<size>
# Never append ?download — it sets Content-Disposition: attachment and turns playback
# into a file save.

# Covers ARE public, so this form is correct for them and only for them:
curl -s -o /dev/null -w 'cover: %{http_code}\n' \
  "$SB/storage/v1/object/public/song-covers/<songId>/v1/cover.jpg"
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

These were real authorization holes. They are **closed in the code on disk today** — `delete-song`,
`like-song` and `get-liked-songs` now take the actor from `requireAdmin()` / `requireUser()` and read
no `userId` from the request, and `get-songs` selects an explicit column list with no join onto
`users`. Treat this subsection as the **regression suite**, not a bug report: it is what proves the
fix survived the deploy, and what catches it coming back.

**Every one of them must fail.** If any returns 200, do not go to production.

```bash
export UC=$(mint user@example.com 'CorrectHorse2!')     # plain user cookie
export AC=$(mint admin@example.com 'CorrectHorse1!')    # admin cookie
export UT=$(tok  user@example.com 'CorrectHorse2!')     # plain user token
export SONG_ID='<any id from /api/get-songs>'
```

**(a) A non-admin cannot delete a song by passing an admin's id.**
The handler *used to* read `{songId, userId}` from the body and look the role up from that
client-supplied `userId`, so anyone who knew an admin's id was an admin. It now calls
`requireAdmin()` first and ignores any `userId` in the body. These calls prove that.

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
curl -s "$APP/api/get-liked-songs?userId=$ADMIN_APP_ID" -H "Cookie: $UC" | head -c 200
# REQUIRED: the CALLER's own liked songs (empty, here), never the admin's. The
# `userId` param is ignored — the id comes from the session. Without the cookie: 401.

curl -s "$APP/api/playlists" -H "Cookie: $UC" | head -c 200
# REQUIRED: only the caller's playlists. There is no /api/get-playlist and no
# endpoint anywhere that accepts a user id.

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
The handler *used to* embed `uploadedBy: { id, email, firstName, lastName }` on every song, so the
catalogue endpoint published admin email addresses to anonymous callers. `SONG_COLUMNS` now lists
columns explicitly and contains no join onto `users` and no `uploaded_by_user_id`. These calls prove
that, and are worth re-running after any change to `src/lib/dto.ts`.

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
#    SUPABASE_SECRET_KEY is the only secret this app has; DATABASE_URL / DIRECT_URL are
#    kept in the loop only to catch someone reintroducing them.
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
| An upload job polls `404` intermittently after working in testing | Job state in a module-level `Map` — per-instance, so once autoscale creates a second instance the poll lands somewhere that has never seen the job. **Already fixed**: `upload-song` and `upload-song/complete` read and write `public.upload_jobs` / `upload_job_items`, and no env var like `UPLOAD_JOB_TTL_MINUTES` exists any more. | Keep it that way. Any per-user state at module scope has this failure. |
| A background task silently never completes | An un-awaited promise after the response returned. The invocation is eligible for suspension the moment it responds; the promise may be frozen mid-flight forever. Always completes locally, because `next dev` is a long-lived process. | `after()` from `next/server` (present in the installed 15.5.23). It is still bounded by `maxDuration` — it is not a job queue. |
| Every page is slow (hundreds of ms) with no slow queries in Supabase | Functions are running in `iad1` against the Mumbai database. Four sequential PostgREST round trips ≈ 750 ms of pure network. | `"regions": ["bom1"]` in `vercel.json` (already committed and matching). Confirm the deployed region in the build summary. |
| A route 504s at the platform default instead of 30 s | The `functions` glob in `vercel.json` did not match it. A non-matching glob **no-ops silently** — it never errors. `src/app/auth/callback/route.ts` is genuinely outside `src/app/api/**/*` (§4.4). | Check the build output's function table. Add an explicit second key rather than widening the existing glob. |
| `prisma: command not found` in the Vercel build log | The `build` script starts with `prisma generate`, but Prisma is gone from this repo entirely. Would break **only on Vercel** — a developer with stale `node_modules` still has the binary. | `"build": "next build"` in `package.json`. Currently correct; do not let it regress. |
| Every album cover is broken, only on Vercel, and the build succeeded | `NEXT_PUBLIC_SUPABASE_URL` was missing **at build time** for that environment, so `next.config.ts` produced an empty `images.remotePatterns` and the optimizer refuses every remote host. | Set the variable for that scope and **redeploy** — the value is baked in at build (§5). |
| Sign-up returns 200 with `confirmation_sent_at`, but no email ever arrives | Supabase's built-in SMTP is shared and rate-limited to a few messages per hour, and will not reliably deliver outside your organisation. It fails quietly. | Configure custom SMTP, or turn confirmation off. §0 step 7 / §1.2. |
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
| Nothing plays and every `audioUrl` is `null` | `SUPABASE_SECRET_KEY` is missing or wrong for this environment. The bucket definitely exists (§1.1), so on this project it is always the key. Signing runs entirely server-side, so a bad key takes out playback for everyone, signed in or not. | Check the variable in §5, then redeploy. Anonymous playback is supported and expected — a signed-out visitor seeing no audio is a bug, not the design. |
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

**Email delivery is on Supabase's built-in SMTP.** Confirmation is on, and the built-in sender is
shared, rate-limited to a handful of messages per hour, and documented as not for production. This
is the most likely thing to make a launched site look broken to the first ten strangers who try it.
§0 step 7 has the options.

**`.env.example` lists exactly the four variables the code reads** — no Clerk, no Cloudinary, no
`DATABASE_URL`. Both former providers are gone from the codebase along with their dependencies and
every API secret they needed. §5 is still the authoritative list for the deploy.

**Route paths in §7 were verified against `src/` on the day of writing**, and the authorization
holes §7.6 tests for are closed in that code. `src/` is under active development; if a path moves,
move the path and keep the assertion.

### Things we could not determine from here

Everything below needs the dashboard — the REST and Auth APIs do not expose it, so these are stated
as unknown rather than guessed at.

1. **Supabase plan** — Dashboard → Organization → Billing. Free caps Storage objects at **50 MB**,
   which rejects a ~100 MB master outright regardless of the bucket's own 100 MB `file_size_limit`.
   Nothing in the API reveals the tier.
2. **Whether custom SMTP is configured** — Authentication → Emails → SMTP Settings.
   `GET /auth/v1/settings` reports the *provider* (email: enabled) and *autoconfirm* (off) but never
   the sender. Assume built-in until you have looked.
3. **The current Site URL and Redirect URL allowlist** — Authentication → URL Configuration. Not
   readable through any public endpoint. §3 and §0 step 6 are what to set them to; you cannot verify
   them except by completing a real sign-up and reading the link.
4. **Vercel plan, team slug, and project name** — Settings → General. The slug and project name go
   verbatim into the redirect allowlist (§3); a wrong slug means every preview login fails.
5. **Migrations 6 and 7** — applied per the operator, but index existence and column grants have no
   REST-observable surface. §2 has a one-line SQL check for each.
6. **Whether the Supabase Vercel integration still auto-syncs redirect URLs.** A 2023 Supabase blog
   post says it does; the current branching-integrations doc does not mention it. **Do not plan
   around it** — configure the wildcards manually as in §3.
7. **Whether Vercel bills Node-runtime middleware as a function invocation.** Unverified. It does
   not affect this deploy: middleware stays on Edge, since `@supabase/ssr` needs nothing Node-only
   (PKCE uses Web Crypto, transport is `fetch`; no Node built-in imports exist in the installed
   packages). Do **not** add `export const runtime = 'nodejs'` — Next.js 16 renames
   `middleware.ts` → `proxy.ts`, where that option throws.
8. **Current Edge middleware bundle-size limit.** Unverified numeric ceiling. Keep the middleware
   import graph tiny regardless: never import the service-role client, `realtime-js`, or anything
   pulling in `fs`/`node:crypto`.
9. **Vercel's branch-name → hostname sanitisation for names containing `.`** — affects whether the
   `*` wildcard matches (§3).

Settled, and no longer open questions: the project region is **`ap-south-1` (Mumbai)**, matched by
`"regions": ["bom1"]` in `vercel.json`; the email provider is enabled with confirmation on; both
Storage buckets and their policies exist; an ADMIN user exists; all 7 migrations are applied.
