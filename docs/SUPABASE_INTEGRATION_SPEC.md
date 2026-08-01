# Supabase Integration Spec — Monolithic Next.js 15 on Vercel

**Status:** implementation spec. Supersedes the four research reports where they conflict.
**Project ref:** `wwtglvbctakstnguqrzk` · **Runtime:** Next.js 15.5.9 (verified in `node_modules/next/package.json`), React 19, Vercel serverless.

---

## 0. Ground truth and what changes under serverless

### 0.1 Repo restructure is a prerequisite, not an optional cleanup

The repo today is `frontend/` + `backend/` + `packages/*` npm workspaces (verified: root `package.json` declares all three). The architecture decision says one Next.js app with code at `src/` and schema at `prisma/`. Every path in this document assumes that move has happened, and **step 1 of §7 is the move itself**. Concretely:

| From | To |
|---|---|
| `frontend/src/**` | `src/**` |
| `packages/database/prisma/**` | `prisma/**` (all 4 migration folders preserved verbatim, including `migration_lock.toml`) |
| `packages/shared/src/**` | `src/lib/schemas/**` (plain modules, no package) |
| `frontend/package.json` deps | root `package.json` |
| `backend/**` | **deleted** |
| root `workspaces` array | **deleted** |

`@swaras/database` and `@swaras/shared` imports become relative/aliased imports (`@/lib/db`, `@/lib/schemas`). Prisma's `generator.output` moves from `../generated/client` to the default `node_modules/.prisma/client` — a custom output path in a single app buys nothing and complicates Vercel's build cache.

**One Prisma change nobody has flagged and which will break the first Vercel deploy:** `binaryTargets = ["native", "debian-openssl-3.0.x"]` is correct for a `node:bookworm-slim` container and **wrong for Vercel**. Vercel's Node runtime is Amazon Linux 2023. Set:

```prisma
binaryTargets = ["native", "rhel-openssl-3.0.x"]
```

Symptom if you skip it: `PrismaClientInitializationError: Query engine library for current platform "rhel-openssl-3.0.x" could not be found` at runtime, not at build.

### 0.2 What serverless changes versus the research's assumptions

The research reports were written assuming a long-running NestJS container. Every one of the following flips:

| Research assumption (NestJS container) | Reality on Vercel serverless |
|---|---|
| `DATABASE_URL` may use **session** mode (5432); prepared statements preserved | **Must** use **transaction** mode (6543) with `pgbouncer=true`. Session mode from serverless exhausts the pool. |
| `connection_limit=10` is fine for a container fleet | **`connection_limit=1`.** Each invocation is its own process. |
| `revalidateTag` unreachable from the API → build a signed `/api/revalidate` webhook, fire from a transactional-outbox hook | **The webhook is deleted from the design.** Mutations and the cache live in the same process. `revalidateTag()` is called directly inside the Server Action / Route Handler, after the Prisma transaction commits. This removes the single most fragile piece of the caching research. |
| `ResponseEnvelopeInterceptor`, `@CacheControl()` decorator, Nest guards | Do not exist. Cache-Control is set per Route Handler via `Response` headers or `next.config.ts` `headers()`. Authorization is a plain function called at the top of each Server Action / Route Handler. |
| `fetch()` Data Cache with `next.tags` is the primary catalog cache | Catalog reads are **direct Prisma calls in Server Components**. `fetch` caching is irrelevant to them. `unstable_cache` is the *only* applicable mechanism. |
| Background work after response (transcode enqueue, upload finalization) | **Not possible.** Anything after the response is killed. Finalization must be a client-driven POST or a Supabase Storage webhook. |
| `jose` + `createRemoteJWKSet` module-level JWKS cache amortized over the process life | Cold starts re-fetch JWKS. Still correct (10-min edge cache), just less efficient. Not a problem — but it is a reason to prefer `@supabase/ssr`'s cookie-based session over hand-rolled JWT verification. |
| Cloudinary SDK / `mongoose` / `next-auth` / `bcryptjs` still in deps | All four are dead weight (verified in `frontend/package.json`). Remove `mongoose`, `next-auth`, `bcryptjs` at restructure time; remove `cloudinary` + `next-cloudinary` only at storage cutover. |

### 0.3 Disagreements between the reports, resolved

| Question | Resolution | How I decided |
|---|---|---|
| Session (5432) or transaction (6543) for runtime? | **Transaction, 6543, `pgbouncer=true`, `connection_limit=1`.** Non-negotiable. | The postgres report allowed session mode only for a long-lived container. That container no longer exists. |
| Direct host `db.<ref>.supabase.co` for `DIRECT_URL`? | **No. Session pooler `:5432`.** | Verified IPv6-only, no A record. Vercel build containers and GitHub Actions are IPv4-only. The direct host is unusable from CI. |
| Clerk Third-Party Auth (TPA) — register Clerk as a Supabase issuer? | **No. Do not enable it.** | TPA exists so `auth.jwt()` works in PostgREST/Storage/Realtime RLS. We do not use PostgREST, and Storage writes go through the service-role key server-side. TPA costs $0.00325/MAU and buys nothing. Skipping it also avoids the unresolved "dual-shape `sub` claim" problem the auth report flagged as needing a spike. |
| Trigger on `auth.users` → insert `public.users`? | **No trigger. Ever.** | The trigger runs inside GoTrue's signup transaction; a `users_email_key` violation 500s the signup. This app already has a `UNIQUE(email)` and already suffered a retry loop from exactly that constraint. Linking happens in `src/app/auth/callback/route.ts` with an upsert that structurally cannot violate it. See §4.3. |
| `'use cache'` / `cacheLife` / `cacheTag`? | **Banned.** Experimental in 15.x, needs `experimental.dynamicIO` + a canary build. Stable only in 16. | Verified: repo is pinned `next@15.5.9`. |
| TUS session expiry: docs say 24h, OSS default is 1h | **Assume 1 hour.** Set `UploadJob.expiresAt = createdAt + 55min`. Measure once a bucket is live and widen if 24h is confirmed. | Pessimistic assumption produces resumable jobs; optimistic assumption produces orphans that can never resume. |
| `aws-0` vs `aws-1` pooler hostname | **Cannot be inferred. Copy verbatim from Dashboard → Project Settings → Database.** Both accept TCP; a successful `nc` proves nothing. | |
| Run Prisma as `postgres` or a dedicated role? | **Dedicated `prisma` role.** | It is the only guardrail that converts `migrate reset` from "deletes every Supabase Auth user" into "permission denied". |
| Prisma or supabase-js for data access? | **Prisma for all table access; supabase-js for Auth + Storage only.** Full justification in §3.4. | |
| Free plan? | **Pro is a hard prerequisite.** Free caps objects at 50 MB; a ~100 MB master is rejected outright. Confirm the plan before writing any storage code. | |

---

## 1. Environment variables — single root `.env.local`

`.env.local` is gitignored by `create-next-app`'s default `.gitignore`. **Verify `git check-ignore -v .env.local` prints a rule before writing anything into it.** Add `.env` and `.env*.local` explicitly if not.

Do **not** use `${VAR}` interpolation anywhere — `dotenv` does not expand without `dotenv-expand`, and Prisma receives the literal `${…}` text.

```bash
# =============================================================================
# SUPABASE — PUBLIC. Safe in the browser bundle. NEXT_PUBLIC_ is CORRECT here.
# =============================================================================
NEXT_PUBLIC_SUPABASE_URL="https://wwtglvbctakstnguqrzk.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."

# Direct storage host — skips the API gateway hop. Required for TUS uploads.
NEXT_PUBLIC_SUPABASE_STORAGE_URL="https://wwtglvbctakstnguqrzk.storage.supabase.co"

# =============================================================================
# SUPABASE — SECRET. NEVER prefix any of these with NEXT_PUBLIC_.
# A NEXT_PUBLIC_ prefix on the line below is a total database compromise:
# the secret key carries BYPASSRLS plus the Auth admin API (create/delete any
# user, mint sessions, change any email => account takeover of anyone).
# =============================================================================
SUPABASE_SECRET_KEY="sb_secret_REPLACE_ME"

# =============================================================================
# POSTGRES — SECRET. Copy the hostname VERBATIM from
# Dashboard -> Project Settings -> Database -> Connection string.
# aws-0 vs aws-1 and the region are per-project and CANNOT be guessed.
# Username is <role>.<project-ref>. Plain `prisma` => "Tenant or user not found".
# =============================================================================

# RUNTIME. Supavisor TRANSACTION mode, port 6543.
#   pgbouncer=true    -> mandatory; disables Prisma's named prepared statements
#   connection_limit=1-> mandatory on serverless; one conn per invocation
#   sslmode=require   -> Prisma defaults to `prefer`, which silently downgrades
#   schema=public     -> pins Prisma's scope; keeps it blind to auth/storage
DATABASE_URL="postgresql://prisma.wwtglvbctakstnguqrzk:REPLACE_WITH_ROTATED_PRISMA_PASSWORD@aws-N-REGION.pooler.supabase.com:6543/postgres?schema=public&sslmode=require&pgbouncer=true&connection_limit=1&pool_timeout=15&connect_timeout=10"

# PRISMA CLI ONLY (migrate deploy / diff / studio). SESSION mode, port 5432.
# NOT db.wwtglvbctakstnguqrzk.supabase.co — that host is IPv6-only on this
# project (verified: AAAA present, no A record) and unreachable from CI and
# from Vercel build containers.
# NO pgbouncer flag here: session mode is a real session, and Prisma Migrate
# needs session-scoped advisory locks.
DIRECT_URL="postgresql://prisma.wwtglvbctakstnguqrzk:REPLACE_WITH_ROTATED_PRISMA_PASSWORD@aws-N-REGION.pooler.supabase.com:5432/postgres?schema=public&sslmode=require"

# =============================================================================
# CLERK — unchanged, stays live through the whole migration
# =============================================================================
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_REPLACE_ME"
CLERK_SECRET_KEY="sk_test_REPLACE_ME"
CLERK_WEBHOOK_SECRET="whsec_REPLACE_ME"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# =============================================================================
# FEATURE FLAGS — the additive-auth and storage switches
# =============================================================================
NEXT_PUBLIC_AUTH_SUPABASE_ENABLED="false"   # shows the Supabase sign-in UI
AUTH_PRIMARY="clerk"                        # clerk | supabase — resolution order
NEXT_PUBLIC_STORAGE_PROVIDER="cloudinary"   # cloudinary | supabase

# =============================================================================
# CLOUDINARY — keep until storage cutover is confirmed, then delete
# =============================================================================
CLOUDINARY_CLOUD_NAME="REPLACE_ME"
CLOUDINARY_API_KEY="REPLACE_ME"
CLOUDINARY_API_SECRET="REPLACE_ME"
```

### 1.1 The `NEXT_PUBLIC_` rule, stated as a hard boundary

**May carry `NEXT_PUBLIC_`:** `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_STORAGE_URL`, `CLERK_PUBLISHABLE_KEY`, the two feature flags, sign-in/up URLs.

**Must never, under any circumstance:** `SUPABASE_SECRET_KEY`, `DATABASE_URL`, `DIRECT_URL`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, `CLOUDINARY_API_SECRET`.

Next.js inlines `NEXT_PUBLIC_*` into the client bundle **at build time**, as a literal string, in every JS chunk that references it. There is no runtime check and no warning. Enforce structurally, not by vigilance:

1. Every module that reads a secret starts with `import 'server-only'`. Importing it from a Client Component then becomes a **build error**, not a leak.
2. Add a build-time assertion in `next.config.ts`:
   ```ts
   for (const k of Object.keys(process.env)) {
     if (k.startsWith('NEXT_PUBLIC_') && /SECRET|SERVICE_ROLE|PASSWORD|DATABASE_URL|DIRECT_URL/i.test(k)) {
       throw new Error(`Refusing to build: ${k} would be inlined into the client bundle.`)
     }
   }
   ```
3. On Vercel, set the public vars for all three environments and the secret vars for **Production + Preview only**, never with "Automatically expose to the browser" checked.

### 1.2 Vercel-specific

`DATABASE_URL` must also be present in the **Build** environment, not just Runtime — `generateStaticParams()` and ISR prerendering execute Prisma queries during `next build`. Build runs in an IPv4-only container, which is the second reason `DIRECT_URL` must be the pooler.

---

## 2. Files to create and modify

Everything below is rooted at the repo root after the restructure. `prisma/` and `supabase/` sit beside `src/`.

### 2.1 Supabase clients

**`src/utils/supabase/client.ts`** — browser client. Publishable key only. Used by Client Components for Supabase sign-in/sign-up and for the TUS uploader's auth header.

```ts
'use client'
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
```

**`src/utils/supabase/server.ts`** — request-scoped server client, publishable key, reads/writes the auth cookies. **Must be called inside the request scope every time — never hoisted to a module-level singleton.** On Vercel a module-level client is shared across concurrent requests on a warm instance and will hand one user's session to another.

```ts
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()               // async in Next 15
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
          catch { /* called from a Server Component; middleware refreshes instead */ }
        },
      },
    },
  )
}
```

The empty `catch` is required, not sloppy: Server Components cannot set cookies, and the middleware in the same file set is what actually persists the refreshed session.

**`src/utils/supabase/middleware.ts`** — session refresh helper. Returns the `NextResponse` with refreshed cookies attached.

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  // MUST be getUser(), not getSession(). getSession() trusts the cookie
  // without revalidating it; getUser() round-trips to the Auth server.
  await supabase.auth.getUser()
  return response
}
```

**`src/utils/supabase/admin.ts`** — service-role client. **This is the single most dangerous file in the repo.**

```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'

// Module-level singleton is SAFE here and only here: this client is
// stateless (no cookies, no per-user session), so cross-request reuse on a
// warm Vercel instance cannot leak one user's identity to another.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)
```

Rules, enforced by an ESLint `no-restricted-imports` rule: importable **only** from `src/lib/storage/**`, `src/lib/auth/**`, and `src/app/api/webhooks/**`. Never from a page, layout, or component.

### 2.2 Database

**`prisma/schema.prisma`** — three edits, no more:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "rhel-openssl-3.0.x"]   // CHANGED: Vercel, not Docker
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")                       // ADDED — highest-risk gap today
}

model User {
  // ...existing fields unchanged...
  supabaseUserId String? @unique @map("supabase_user_id") @db.Uuid   // ADDED
}
```

**Do not** add `previewFeatures = ["multiSchema"]`. **Do not** add `schemas = [...]`. **Do not** create any Prisma relation to `auth.users`. Those three lines are what keep `migrate` blind to `auth`/`storage`/`realtime` and are the difference between a safe migration and prisma#17734 (`cannot drop table auth.users because other objects depend on it`, failing partway through the drop).

**`src/lib/db/prisma.ts`** — the serverless-safe singleton (§3.2).

**`prisma/migrations/20260810_000000_add_supabase_identity/migration.sql`** — generated by `migrate diff` against a **local throwaway Postgres**, never against Supabase:

```sql
ALTER TABLE "public"."users" ADD COLUMN "supabase_user_id" UUID;
CREATE UNIQUE INDEX "users_supabase_user_id_key" ON "public"."users"("supabase_user_id");
```

Note deliberately **no** `REFERENCES auth.users(id)`. A foreign key into a Supabase-managed schema is permanent, unresolvable drift the next time GoTrue ships a migration. The link is enforced in application code.

**`prisma/migrations/20260810_000100_enable_rls/migration.sql`** — hand-written, contains only `ALTER TABLE … ENABLE ROW LEVEL SECURITY`, `CREATE POLICY`, and the `REVOKE/GRANT (columns)` pair for `public.users`. Full SQL in §6.4. Prisma does not model policies, so they are invisible to `migrate diff` and will never be dropped as drift.

**`supabase/sql/*.sql`** — applied **by hand in the SQL Editor as `postgres`**, checked into git for review but not part of Prisma's migration history. These require privileges the `prisma` role does not and should not have:

| File | Contents | Why not a Prisma migration |
|---|---|---|
| `00_create_prisma_role.sql` | `create user "prisma" …` | Bootstraps the role Prisma itself uses |
| `01_extensions.sql` | `create extension if not exists pg_trgm;` + the `songs_title_trgm` GIN index | `CREATE EXTENSION` needs `postgres` |
| `02_storage_buckets.sql` | bucket rows + `file_size_limit` + `allowed_mime_types` | writes to `storage.buckets`, owned by `supabase_storage_admin` |
| `03_storage_policies.sql` | policies on `storage.objects` | `prisma` cannot create policies on a table it does not own |
| `04_postgrest_lockdown.sql` | explicit `revoke all on all tables in schema public from anon, authenticated;` | belt-and-braces; see §6.5 |

**Hard rule to write into `CLAUDE.md`:** *Prisma migrations touch only `public` objects owned by the `prisma` role. Anything needing `postgres` privileges lives in `supabase/sql/` and is applied manually.*

### 2.3 Auth

**`src/middleware.ts`** — composes Clerk and Supabase. Order matters: Supabase's session refresh must run and its response must be the one returned, or the refreshed auth cookies are dropped.

```ts
import { clerkMiddleware } from '@clerk/nextjs/server'
import { updateSession } from '@/utils/supabase/middleware'

export default clerkMiddleware(async (_auth, request) => updateSession(request))

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|m4a)$).*)'],
}
```

**`src/lib/auth/current-user.ts`** — the single authorization entry point. Every Server Action, Route Handler, and protected Server Component calls this and nothing else.

```ts
import 'server-only'
import { cache } from 'react'
import { auth as clerkAuth } from '@clerk/nextjs/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/db/prisma'

export type Actor = { appUserId: string; role: 'USER' | 'ADMIN'; source: 'clerk' | 'supabase' }

// React `cache` dedupes within a single request render pass only — it is NOT
// a cross-request cache and never touches unstable_cache. This is correct and
// is the ONLY caching that may ever be applied to identity.
export const getActor = cache(async (): Promise<Actor | null> => {
  const primary = process.env.AUTH_PRIMARY ?? 'clerk'
  const resolvers = primary === 'supabase'
    ? [resolveSupabase, resolveClerk]
    : [resolveClerk, resolveSupabase]
  for (const r of resolvers) { const a = await r(); if (a) return a }
  return null
})

async function resolveClerk(): Promise<Actor | null> {
  const { userId } = await clerkAuth()
  if (!userId) return null
  const u = await prisma.user.findUnique({
    where: { vendorId: userId }, select: { id: true, role: true, status: true },
  })
  return u && u.status === 'ACTIVE' ? { appUserId: u.id, role: u.role, source: 'clerk' } : null
}

async function resolveSupabase(): Promise<Actor | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()   // never getSession()
  if (!user) return null
  const u = await prisma.user.findUnique({
    where: { supabaseUserId: user.id }, select: { id: true, role: true, status: true },
  })
  return u && u.status === 'ACTIVE' ? { appUserId: u.id, role: u.role, source: 'supabase' } : null
}

export async function requireActor() {
  const a = await getActor(); if (!a) throw new Error('UNAUTHENTICATED'); return a
}
export async function requireAdmin() {
  const a = await requireActor(); if (a.role !== 'ADMIN') throw new Error('FORBIDDEN'); return a
}
```

**`src/app/auth/callback/route.ts`** — Supabase OAuth/magic-link exchange **plus identity linking**. This replaces the `on_auth_user_created` trigger entirely. See §4.3 for the linking logic and why it cannot reproduce the retry loop.

**`src/app/(auth)/sign-in-supabase/page.tsx`** — new, additive, rendered only when `NEXT_PUBLIC_AUTH_SUPABASE_ENABLED === 'true'`. The existing Clerk `/sign-in` and `/sign-up` pages are untouched.

**`src/app/api/webhooks/clerk/route.ts`** and **`.../handlers/handleUserCreated.ts`** — modified to fix the retry-loop bug (§4.4). This must ship **before** any Supabase auth work, because it is a live production defect.

### 2.4 Storage

**`src/lib/storage/paths.ts`** — the single source of truth for object keys. Paths are immutable and versioned; nothing is ever overwritten in place.

```ts
export const audioKey  = (songId: string, v: number, ext: string) => `${songId}/v${v}/audio.${ext}`
export const coverKey  = (songId: string, v: number, ext: string) => `${songId}/v${v}/cover.${ext}`
export const stagingKey = (jobId: string, itemId: string, ext: string) => `${jobId}/${itemId}.${ext}`
```

**`src/lib/storage/storage.service.ts`** — `import 'server-only'`, uses `supabaseAdmin`. Exports: `createUploadToken()`, `promoteToPublic()`, `publicAudioUrl()`, `createSignedAudioUrl()`, `deleteSongObjects()`. Details in §6.

**`src/lib/storage/tus-upload.ts`** — `'use client'`, wraps `tus-js-client` with the mandatory `chunkSize: 6 * 1024 * 1024`.

**`src/app/api/uploads/signed-token/route.ts`** — admin-gated (`requireAdmin()`), mints the TUS upload token. The service key never leaves the server.

### 2.5 Caching

**`src/lib/cache/tags.ts`** — tag vocabulary, single source of truth.
**`src/lib/cache/catalog.ts`** — the **only** file in the repo permitted to import `unstable_cache`, enforced by ESLint. Details in §5.
**`src/lib/cache/revalidate.ts`** — one thin wrapper around `revalidateTag` so the eventual Next 16 migration (`revalidateTag(tag, 'max')` / `updateTag()`) is a one-file change.

### 2.6 Deleted

`backend/` entirely. `src/app/api/check-admin/` (replaced by `getActor()` in a Server Component). Post-storage-cutover: `cloudinary`, `next-cloudinary`. Immediately: `mongoose`, `next-auth`, `bcryptjs` — all three are unused leftovers.

---

## 3. Serverless connection management — the highest-risk area

### 3.1 The exact URLs and why

| Consumer | Env var | Host | Port | Required params |
|---|---|---|---|---|
| Prisma Client at runtime (Server Components, Server Actions, Route Handlers, ISR regeneration, `generateStaticParams` at build) | `DATABASE_URL` | `aws-N-REGION.pooler.supabase.com` | **6543** | `schema=public&sslmode=require&pgbouncer=true&connection_limit=1&pool_timeout=15&connect_timeout=10` |
| `prisma migrate deploy` / `diff` / `studio` | `DIRECT_URL` | `aws-N-REGION.pooler.supabase.com` | **5432** | `schema=public&sslmode=require` — **no** `pgbouncer` flag |
| Anything | ~~`db.wwtglvbctakstnguqrzk.supabase.co`~~ | — | — | **Never.** IPv6-only on this project; unreachable from Vercel build, Vercel runtime, and GitHub Actions. |

Username is `prisma.wwtglvbctakstnguqrzk` on both. Plain `prisma` on the pooler yields `FATAL: Tenant or user not found`.

**Why transaction mode is mandatory, in numbers.** Supavisor in transaction mode accepts a large number of *client* connections (default `max_client_conn` in the low hundreds) and multiplexes them over a small *server* pool (default pool size ~15 on Free/Small tiers). Session mode pins one server connection per client connection for the whole session. A Vercel function under 40 concurrent requests, at `connection_limit=1`, opens 40 client connections. Through transaction mode: 40 clients over 15 backends, fine. Through session mode: 40 clients demanding 40 backends against a pool of 15 → 25 of them hang and then fail.

**Why `connection_limit=1`.** `connection_limit` is Prisma's *own* client-side pool, defaulting to `num_cpus * 2 + 1`. On Vercel each concurrent invocation is a separate isolate with its own `PrismaClient`. Leaving the default means a single warm instance holds ~5 connections while serving one request; 40 concurrent invocations then demand 200 connections. `connection_limit=1` makes the arithmetic `concurrency == connections`, which is the only regime you can reason about.

**Fluid compute caveat.** If Vercel Fluid compute is enabled, one instance serves multiple concurrent invocations in one process, so one `PrismaClient` is shared and `connection_limit=1` becomes a bottleneck (requests serialize on a single connection, surfacing as `P2024`). If and only if Fluid is on, raise to `connection_limit=5` and re-measure. Default assumption in this spec: classic serverless, `connection_limit=1`.

### 3.2 The client singleton

```ts
// src/lib/db/prisma.ts
import 'server-only'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Two things this does **not** do, deliberately:

- **No `$connect()` at module load.** Prisma connects lazily on first query. Eager connect burns a connection on every cold start including ones that never touch the DB (static asset routes, redirects).
- **No `$disconnect()` in a request handler or a `finally`.** Disconnecting after each request destroys the warm-instance reuse that is the entire point of the singleton and turns every request into a fresh TLS handshake against Supavisor. The only place `$disconnect()` belongs is a standalone script (a seed or migration helper).

The `globalForPrisma` assignment is guarded to dev because in dev, HMR re-evaluates modules on every edit and would otherwise leak a client per save. In production on Vercel, module scope already persists for the instance's life.

### 3.3 What fails, and exactly how it manifests

| Misconfiguration | Error text you will see | When it shows up |
|---|---|---|
| `DATABASE_URL` on 6543 **without** `pgbouncer=true` | `prepared statement "s0" already exists` / `prepared statement "s3" does not exist` | Only under concurrency. Passes local dev and a single-user smoke test. Fails in production, intermittently, load-dependent. **The nastiest failure in this list.** |
| `DATABASE_URL` on 5432 (session mode) from Vercel | `MaxClientsInSessionMode: max clients reached`, or Prisma `P2024: Timed out fetching a new connection from the connection pool` | Under traffic spikes. Looks like "the database is slow." |
| `connection_limit` left at default | `FATAL: sorry, too many clients already` / `P2024` | At moderate concurrency; scales with instance count, so it appears suddenly as traffic grows. |
| `DIRECT_URL` unset (so CLI falls through to `DATABASE_URL` on 6543) | `Timed out trying to acquire a postgres advisory lock` — sometimes **after partially applying DDL**, leaving a `_prisma_migrations` row in `failed` state | On the very first `migrate deploy`. Advisory locks are session-scoped; transaction mode hands the lock's backend to another client at COMMIT. |
| `DIRECT_URL` pointed at `db.<ref>.supabase.co` | `P1001: Can't reach database server` / `ENETUNREACH` | From CI or Vercel build only. Works on the developer's Mac, which has IPv6 egress. Classic "works on my machine." |
| Username `prisma` instead of `prisma.wwtglvbctakstnguqrzk` | `FATAL: Tenant or user not found` | Immediately, on any connection. |
| `sslmode` omitted | No error. Prisma's default `prefer` silently falls back to plaintext if TLS negotiation fails. | Never — that is the problem. |
| `binaryTargets` missing `rhel-openssl-3.0.x` | `Query engine library for current platform "rhel-openssl-3.0.x" could not be found` | First Vercel deploy, at runtime, after a green build. |
| `prisma generate` not in the build script | `@prisma/client did not initialize yet` | On Vercel only — its dependency cache can skip `postinstall`. Fix: `"build": "prisma generate && next build"`. |

### 3.4 Is Prisma even the right client here?

**Yes for all table access. supabase-js is for Auth and Storage only.** Reasoning, in order of weight:

1. **Authorization lives in application code, not in RLS.** Both the caching/RLS report and the postgres report converge on this: Prisma connects as a role with `BYPASSRLS`, so every policy is inert on the primary data path. Switching catalog reads to supabase-js/PostgREST would move authorization into RLS — a genuinely different security model, requiring the custom-access-token hook, the `app_user_id` claim, and Supabase Auth to be *fully live*. Clerk is still the identity provider today, so `auth.jwt()` is empty and RLS-based authz would deny everything. supabase-js for data is not merely unnecessary now; it is **non-functional** until after Clerk is removed.
2. **The schema is already Prisma's.** Four migrations, hand-written `@map`s, typed relations across `Song`/`Artist`/`Album`/`SongCredit`/`Playlist`. PostgREST's embedded-resource syntax would be a rewrite of every query for no gain.
3. **The connection-cap objection is real but priced in.** PostgREST is HTTP and consumes no Postgres connection from your budget — a genuine advantage. Transaction-mode pooling at `connection_limit=1` reduces that advantage to a manageable constant, and the tagged Next.js cache (§5) means the hot catalog path mostly does not hit Postgres at all.
4. **Where supabase-js *is* the right tool, use it without hesitation:** `supabase.auth.*` (session cookies, OAuth, token refresh — reimplementing this with `jose` would be strictly worse), `supabase.storage.*` (signed URLs, TUS token minting, object deletion), and `supabase.auth.admin.*` (user creation during the eventual Clerk→Supabase user migration).

**The documented escape hatch.** If connection pressure becomes real — sustained `P2024` under load even at `connection_limit=1` — the correct move is *not* to raise the limit. It is to move the highest-volume anonymous read (`GET /songs` list) to supabase-js/PostgREST with the publishable key. That path consumes zero Postgres connections and is already secured by the `songs_select_public` policy in §6.4. It requires one additional grant (`grant select on public.songs, public.artists, public.albums to anon, authenticated;`) because Prisma-created tables are owned by `prisma` and are invisible to PostgREST by default (§6.5). Do not do this preemptively — it splits the data-access layer in two, and the cache should make it unnecessary.

---

## 4. Auth plan — additive Supabase, Clerk stays live

### 4.1 The model

Clerk remains the sole authenticator until Supabase sign-in is confirmed working end to end. `public.users` carries **both** identity links simultaneously:

- `vendorId` (existing, `@unique`) — Clerk `user_...` id. Never repurposed, never cleared; it stays as the audit trail even post-migration.
- `supabaseUserId` (new, `@unique`, nullable, `@db.Uuid`) — `auth.users.id`.
- `email` (existing, `@unique`) — **the linking key between the two.**

`getActor()` (§2.3) tries both in an order controlled by `AUTH_PRIMARY`. Flipping that one env var is the cutover; flipping it back is the rollback. No code change, no deploy.

**Do not repoint `users.id` to `auth.users.id`.** Every FK in the schema (`Song.uploadedByUserId`, `Playlist.userId`, `Like.userId`, `UploadJob.userId`) references it. A nullable link column is additive and reversible; a PK change is neither.

**Do not add `REFERENCES auth.users(id)` to `supabase_user_id`.** Supabase ships GoTrue migrations that alter `auth` on their own schedule; every one becomes permanent Prisma drift. Supabase's own guidance is to duplicate values into a Prisma-managed table rather than reference `auth` directly.

### 4.2 Third-party auth: explicitly not used

We are **not** registering Clerk as a Supabase TPA issuer, and Clerk tokens are never passed to supabase-js. Rationale in §0.3. The consequence to state plainly: during the dual-auth window, `auth.jwt()` is empty for Clerk-authenticated users, so **RLS grants them nothing** — which is fine, because they reach data through Prisma (BYPASSRLS) and storage through the service-role key. RLS is the backstop for the PostgREST endpoint, not the authorization layer.

### 4.3 Linking, and why there is no trigger

**No `on_auth_user_created` trigger. Not now, not later.** The trigger runs inside GoTrue's signup transaction; any exception rolls the signup back with an opaque `500 Database error saving new user`. With a `UNIQUE(email)` on `public.users` and existing Clerk-era rows, a Supabase signup by an email that already exists would 500 on the trigger's INSERT — the exact failure class that already produced the webhook retry loop, relocated into the signup path where it is *harder* to diagnose.

Linking happens in `src/app/auth/callback/route.ts`, in application code, after the session is established and outside any GoTrue transaction:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  if (!code) return NextResponse.redirect(`${origin}/sign-in?error=missing_code`)

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(`${origin}/sign-in?error=exchange_failed`)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return NextResponse.redirect(`${origin}/sign-in?error=no_email`)

  await linkSupabaseIdentity(user.id, user.email, user.user_metadata)
  return NextResponse.redirect(`${origin}${next}`)
}
```

`linkSupabaseIdentity` is the piece that must be structurally incapable of a unique violation:

```ts
// src/lib/auth/link-identity.ts
export async function linkSupabaseIdentity(
  supabaseUserId: string, email: string, meta: Record<string, unknown> = {},
) {
  const normalized = email.trim().toLowerCase()

  // 1. Already linked to THIS supabase id — idempotent no-op.
  const linked = await prisma.user.findUnique({ where: { supabaseUserId } })
  if (linked) return linked

  // 2. An email-matched row exists (Clerk-era user signing in via Supabase).
  //    Attach the id to it. Never INSERT — that is what would collide.
  const byEmail = await prisma.user.findUnique({ where: { email: normalized } })
  if (byEmail) {
    if (byEmail.supabaseUserId && byEmail.supabaseUserId !== supabaseUserId) {
      // Two auth.users rows resolve to one app row. Do NOT overwrite the link.
      throw new IdentityConflictError(byEmail.id, supabaseUserId)
    }
    return prisma.user.update({
      where: { id: byEmail.id },
      data: { supabaseUserId, vendorData: { ...(byEmail.vendorData as object ?? {}), supabase: meta } },
    })
  }

  // 3. Genuinely new user. The race between step 2 and here is closed by
  //    catching P2002 and re-reading, not by hoping the window is small.
  try {
    return await prisma.user.create({
      data: {
        email: normalized, supabaseUserId, vendorName: 'supabase',
        firstName: meta.first_name as string ?? null,
        lastName:  meta.last_name  as string ?? null,
        profileImageUrl: (meta.avatar_url ?? meta.picture) as string ?? null,
      },
    })
  } catch (e) {
    if (isP2002(e)) {
      const raced = await prisma.user.findUnique({ where: { email: normalized } })
      if (raced) return prisma.user.update({ where: { id: raced.id }, data: { supabaseUserId } })
    }
    throw e
  }
}
```

Three properties that matter: it is **idempotent** (safe to call on every sign-in), it **never inserts when an email row exists**, and it **catches P2002 and converges** rather than propagating a hard failure.

Case-normalize the email on **both** paths. Clerk and Supabase may deliver different casing for the same address, and `UNIQUE` on Postgres `text` is case-sensitive — `User@x.com` and `user@x.com` become two rows that map to one human. Also add, in the same migration, a normalization backfill and a `CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email))` if any existing rows collide only by case.

### 4.4 The existing webhook retry loop — fixed before anything else

Current defect in `src/app/api/webhooks/clerk/handlers/handleUserCreated.ts`: existence is checked by `vendorId` only, then `prisma.user.create({ data: { email, ... } })` runs. A second Clerk identity with an already-present email has a *new* `vendorId`, so the guard passes, the create hits P2002 on `email`, the handler throws, and `route.ts` returns 400. Svix retries every non-2xx on its backoff schedule, and the conflicting row never goes away, so the event can never succeed.

Two independent fixes, both required:

1. **Resolve identity by `vendorId` OR `email`, then link — never blind-create.** Reuse the same shape as `linkSupabaseIdentity`, writing `vendorId` instead of `supabaseUserId`. Extract the common logic into `src/lib/auth/link-identity.ts` so both providers use one code path and one set of guarantees.
2. **Correct the status-code semantics.** A *permanent* error (P2002, malformed payload, unknown event type) must return **2xx** and write a row into the existing `WebhookEvent` table for manual reconciliation. Only *transient* errors (DB unreachable, connect timeout) return 5xx to earn a retry. The current code returns 400 for everything, which conflates the two and guarantees an infinite retry of the unfixable case.

Add `WebhookEvent.providerEventId @unique` and check it first — Svix delivers at-least-once, so the handler must be idempotent regardless.

### 4.5 Every place the two systems can conflict

| # | Conflict | Design mitigation |
|---|---|---|
| 1 | Same person signs in via Clerk and Supabase → two `public.users` rows | Impossible: `UNIQUE(email)` + link-don't-insert in `linkSupabaseIdentity`. The unique constraint is now a *feature*, because nothing inserts on collision. |
| 2 | Both middlewares try to own the response | `clerkMiddleware` wraps `updateSession` and returns *its* `NextResponse`. Returning Clerk's would drop the refreshed Supabase cookies — session appears to expire every request. |
| 3 | Both sessions present simultaneously (user signed into both) | `AUTH_PRIMARY` gives a deterministic order. Never merge; never let a request be "half authenticated." |
| 4 | Role divergence — `role` promoted in Clerk's metadata but not in `public.users` | `public.users.role` is the **only** source of truth. Never read a role from a Clerk claim or a Supabase JWT. |
| 5 | Sign-out from one provider leaves the other session live | The sign-out action calls both `signOut()`s unconditionally, regardless of which produced the session. |
| 6 | Cookie collisions | None: Clerk uses `__session`/`__client_uat`, Supabase uses `sb-<ref>-auth-token`. Distinct namespaces. Verify after wiring, don't assume. |
| 7 | Email changed in one provider, stale in the other | Neither provider's webhook may rewrite `email` on a row that already has *both* links set without a manual reconciliation step. Log to `WebhookEvent` instead. |
| 8 | Case-only email divergence between providers | Normalize to lowercase at every write; `lower(email)` unique index as backstop. |
| 9 | `getSession()` used instead of `getUser()` anywhere | `getSession()` trusts the cookie without revalidating. ESLint `no-restricted-syntax` ban on `auth.getSession()` in server code. |
| 10 | Clerk keys revoked before Supabase is confirmed | Revocation is the **last** step of §7, after `AUTH_PRIMARY=supabase` has run in production for a full session-lifetime window. |
| 11 | Password-hash migration produces users who can't sign in | Clerk's CSV `password_hasher` column must be `bcrypt` or `argon2` for Supabase's `password_hash` import to work. Any other value → that cohort gets a forced reset email. Verify the actual values in a real export; the column names come from third-party importers, not Clerk's own docs. |
| 12 | `email_confirm: true` applied blanketly during bulk import | Only for emails Clerk had genuinely verified (`isEmailVerified` in the existing `clerkUserUtils.ts`). Blanket-confirming unverified emails imports an account-takeover vector. |
| 13 | MFA/TOTP users | Secrets are not portable. Those users must re-enroll. Communicate before cutover. |

---

## 5. Caching plan

### 5.1 Which mechanism, and is it stable

**`unstable_cache` + `revalidateTag`, plus route-segment `export const revalidate` for ISR.** Both are production-stable on `next@15.5.9`.

The decisive change from the research: catalog data is now read by **calling Prisma directly inside Server Components**, not by `fetch`ing an external API. The `fetch` Data Cache therefore does not apply at all — it only caches `fetch()`. `unstable_cache` is the *only* mechanism that can cache a non-`fetch` call, which makes it mandatory rather than optional.

The `unstable_` prefix is misleading and the API has never been renamed; it is what the Next.js docs themselves prescribe for caching a database call. On Vercel it is backed by the Vercel Data Cache, which is **shared across instances and persists across deployments** — the property that makes it work at all in serverless.

**Banned:** `'use cache'`, `cacheLife()`, `cacheTag()`, `updateTag()`, `revalidateTag(tag, 'max')`. All are Next 16 or require `experimental.dynamicIO` on a canary build. Note for the eventual 16 upgrade: `'use cache'` entries live in an in-memory LRU keyed by build ID and **do not survive a deploy**, and on serverless often not even across requests — so "migrate `unstable_cache` → `use cache`" is not a free win for a catalog you want warm. Route every `revalidateTag` call through `src/lib/cache/revalidate.ts` so the migration is one file.

**`axios` is banned from all server-side code.** Next patches global `fetch`; `axios` uses Node's `http`. Server-side axios calls are not cached, not deduped, not memoized — no error, no warning, just a permanent cache miss. It stays only for client-side TanStack Query calls, and ideally goes away entirely.

### 5.2 Tag vocabulary

```ts
// src/lib/cache/tags.ts
export const songTags = {
  all:  'songs',
  list: 'songs:list',
  one:  (id: string) => `song:${id}`,
}
export const artistTags = { all: 'artists', one: (id: string) => `artist:${id}` }
export const albumTags  = { all: 'albums',  one: (id: string) => `album:${id}` }
```

Constraints: tags are max 256 chars, case-sensitive, max 128 per entry. UUIDs are 36 chars — fine.

**Deliberately absent: `search`, `playlists:*`, `likes:*`.** Those reads are never server-cached, so a tag for them would be a lie inviting someone to "just add caching" behind it later.

### 5.3 The cached functions

```ts
// src/lib/cache/catalog.ts — the ONLY file allowed to import unstable_cache
import 'server-only'
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/db/prisma'
import { songTags } from './tags'

export const getSongPage = unstable_cache(
  async (page: number, pageSize: number, sort: 'recent' | 'title') =>
    prisma.song.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: sort === 'title' ? { title: 'asc' } : { createdAt: 'desc' },
      select: { /* explicit; NEVER any per-user field */ },
    }),
  ['songs:list'],
  { tags: [songTags.all, songTags.list], revalidate: 3600 },
)

export const getSongDetail = unstable_cache(
  async (id: string) => prisma.song.findUnique({ where: { id }, include: { credits: true, album: true } }),
  ['song:detail'],
  { tags: [songTags.all], revalidate: 3600 },
)
```

Two things people get wrong:

- **`keyParts` is a prefix, not the key.** The real key is `keyParts` + the serialized **arguments** + a hash of the function source. `page`/`pageSize`/`sort` being *arguments* is what separates page 1 from page 2. Close over them instead of passing them and page 2 starts serving page 1.
- **`revalidate: 3600` is a safety net, not the mechanism.** Tags are the mechanism. The TTL only bounds the damage from a missed invalidation.

For `getSongDetail`, tag `song:${id}` cannot be passed in the static options object (it depends on the argument). Either wrap per-id — `const get = (id) => unstable_cache(fn, ['song:detail', id], { tags: [songTags.one(id), songTags.all] })()` — or accept `songs` as the blast radius. Wrap per-id; the blast radius matters when a single title edit would otherwise dump the whole catalog.

Song detail routes additionally use ISR: `generateStaticParams()` over the top N songs plus `export const revalidate = 3600`.

### 5.4 Invalidation matrix

Called **directly, in-process, after the Prisma transaction commits.** No webhook, no secret, no allowlist — because the mutation and the cache are now in the same Next.js process. This is the single biggest simplification the monolith buys.

| Mutation (Server Action / Route Handler) | Calls |
|---|---|
| create song | `revalidateTag('songs')`, `revalidateTag('songs:list')`, `revalidatePath('/')` if home renders a "latest" rail |
| upload job → `COMPLETED` (N songs) | `revalidateTag('songs')`, `revalidateTag('songs:list')` — **once at job completion**, not per item |
| update song (title/cover/genre/lyrics) | `revalidateTag(song:${id})` **and** `revalidateTag('songs:list')` — list cards render title + cover, so a detail-only edit still dirties the list |
| delete song | `revalidateTag(song:${id})`, `revalidateTag('songs')`, `revalidateTag('songs:list')`, `revalidatePath('/songs/${id}')` |
| artist / album / movie write | corresponding `*.all` + `songs:list` (list cards show artist names) |
| playlist create/rename/delete, add/remove/reorder songs | **nothing** — client cache only |
| like / unlike | **nothing** — client cache only, optimistic |
| search | **nothing** — CDN TTL only |

**Ordering rule that will bite if ignored:** revalidate **after** the transaction commits, never inside it. Revalidating first makes Next re-read the *old* row and re-cache it — you have invalidated the cache into a worse state.

```ts
'use server'
export async function updateSong(id: string, data: UpdateSongInput) {
  await requireAdmin()
  const song = await prisma.$transaction(async (tx) => tx.song.update({ where: { id }, data }))
  revalidateTag(songTags.one(id))     // AFTER commit
  revalidateTag(songTags.list)
  return song
}
```

**Router Cache caveat:** `revalidateTag` clears the server Data Cache, not the browser's Router Cache. After an admin uploads from the admin UI, call `router.refresh()` in that client component or the admin will swear the upload didn't work. (Next 16 coordinates this via `x-nextjs-stale-time`; 15 does not.)

### 5.5 The per-user cache-key trap — the rule and the enforcement

**Rule R1: per-user data is never put in `unstable_cache`. Not with a user in the key, not with a tag. Never.**

`unstable_cache`'s key is `keyParts` + serialized arguments + a hash of the function source. **It contains no notion of the session**, and reading `cookies()`/`headers()`/`auth()` inside a cache scope is explicitly unsupported. So this compiles, passes review, works perfectly for the first user, and is a data breach — persisted to the Vercel Data Cache, shared across every instance, surviving deploys:

```ts
// ☠️ Serves the FIRST user's playlists to EVERY user.
export const getMyPlaylists = unstable_cache(
  async () => {
    const { userId } = await auth()
    return prisma.playlist.findMany({ where: { userId } })
  },
  ['playlists'],                      // key has no user in it
  { revalidate: 60 },
)
```

Three layers can each produce this independently: `unstable_cache` with a user-less key; the Full Route Cache prerendering a page that renders per-user data but never touches a request-time API (one user's HTML served from the CDN to everyone); and, if anyone reintroduces server-side `fetch` with an `Authorization` header, per-token cache fragmentation that writes each user's private JSON into the shared on-disk Data Cache.

Playlists and likes are small, hot, per-user, and change on user action. The correct cache is **TanStack Query in the browser** — per-user by construction, dies with the tab, no shared storage, optimistic updates make it feel instant. There is no meaningful server-side win to trade against the risk.

**Rule R2 — structural enforcement, because reviewers will not catch this:**

```jsonc
// eslint.config.mjs
{
  files: ['src/**/*.{ts,tsx}'],
  ignores: ['src/lib/cache/catalog.ts'],
  rules: {
    'no-restricted-imports': ['error', {
      paths: [{
        name: 'next/cache',
        importNames: ['unstable_cache'],
        message: 'unstable_cache is confined to src/lib/cache/catalog.ts. Per-user data is cached in TanStack Query, never on the server.',
      }],
    }],
  },
}
```

**Rule R3 — keep the catalog anonymous.** `getSongPage` must never return `isLiked`, `inPlaylist`, or any per-user field. Ship a separate `getLikedSongIds()` returning a bare `string[]`, fetched client-side via TanStack Query, merged in the component. This one decision is what keeps the catalog cacheable at all; the moment one user-specific field enters the catalog payload, the highest-value cache in the app is gone.

**Rule R4 — a unique key is not a safe key.** `unstable_cache(fn, ['playlists', userIdFromSearchParams])` has a unique key *and* writes private data to shared storage keyed by an attacker-controlled value. That is an IDOR with a persistent cache in front of it — strictly worse than a plain IDOR. If a user id ever enters a cache key, it must come from `getActor()`, resolved *outside* the cached function and passed as an argument.

**Rule R5 — the test that would actually catch it.** Sign in as A → load `/playlists` → sign in as B → load `/playlists` → assert B's response contains zero of A's playlist ids. Run it against `next build && next start`. **The bug does not reproduce in `next dev`**, which renders every page on demand and never caches. That is precisely why it ships to production so often.

**Rule R6 — headers as the last line.** Every per-user Route Handler returns `Cache-Control: private, no-store` plus `Vary: Authorization`, so even if the app tier is wrong, no CDN or corporate proxy holds the payload.

### 5.6 HTTP cache headers

Set in `next.config.ts` `headers()` for static patterns, and per-response for dynamic ones. **The default must be `no-store`, with public caching opted into explicitly** — the failure mode of the opposite default is a public CDN entry containing a user's playlists.

| Route | `Cache-Control` |
|---|---|
| `/` , `/songs`, `/songs/[id]` (ISR pages) | Vercel manages; do not override |
| `GET /api/search` | `public, max-age=0, s-maxage=30, stale-while-revalidate=120` |
| `GET /api/playlists*`, `/api/likes*`, `/api/upload-jobs*` | `private, no-store` + `Vary: Authorization` |
| all `POST/PATCH/DELETE` | `no-store` |
| Supabase Storage objects | `public, max-age=31536000, immutable` — set via the upload's `cacheControl` option, safe **only** because paths are versioned and never reused |

Search additionally needs the database fixed, not just cached: `CREATE EXTENSION pg_trgm; CREATE INDEX songs_title_trgm ON songs USING gin (title gin_trgm_ops);`. Unindexed `ILIKE '%q%'` is a sequential scan on every keystroke and no cache layer rescues that. Normalize `q` server-side (trim, lowercase, collapse whitespace, reject `len < 2`) before it becomes a CDN cache key, so `"Kishore"`, `"kishore "`, and `"KISHORE"` collide into one entry. **Never** put search in `unstable_cache` — unbounded key space, evicts the catalog entries you actually want, and no sane tag.

---

## 6. Storage plan

**Prerequisite: the project must be on Pro.** Free caps every object at 50 MB, hard, unraisable. A ~100 MB master is rejected outright. Confirm before writing a line of storage code.

### 6.1 Bucket layout

| Bucket | Public | Size limit | MIME allowlist | Purpose |
|---|---|---|---|---|
| `song-audio` | **public** | 209715200 (200 MB) | `audio/mpeg, audio/mp4, audio/aac, audio/flac, audio/wav, audio/ogg` | released, playable masters |
| `song-covers` | **public** | 10485760 (10 MB) | `image/jpeg, image/png, image/webp` | artwork |
| `uploads-staging` | **private** | 209715200 | same as audio | TUS landing zone; admin-only; nothing here is ever served to listeners |

### 6.2 The playback-URL decision — public bucket, not signed URLs

**This is the highest-leverage decision in the storage integration, and the research flagged it as the one way this migration can make playback *worse* than today.**

Supabase's own Smart CDN documentation states that two different signed URLs for the same object, even generated seconds apart, each maintain an independent cache entry — the token is part of the cache key. So the obvious implementation (mint a fresh signed URL on every play) makes **every playback a CDN MISS pulling the full ~100 MB from origin**, and with Range requests, **every seek re-fetches too**. That is unambiguously worse than serving a plain MP3 from a CDN, on latency, on cost, and on egress billing.

**Decision: released catalog lives in a public bucket.** No tokens, one cache key per object, shared across all users, maximum hit rate. Combined with:

- **Immutable versioned paths** — `{songId}/v{n}/audio.{ext}`, never overwritten in place. Required because the standard CDN has no invalidation and Smart CDN (Pro+) still takes up to 60s to propagate. Replacing a file under a `max-age=31536000` header otherwise serves stale forever.
- **`cacheControl: '31536000'`** at upload — a **string of seconds**, not a header string. storage-js defaults to `'3600'`, which is far too short for immutable masters.
- **UUID paths** provide obscurity, not security. Accept this explicitly: a public bucket means the object URL is a bearer token. For a music catalog that is the correct trade — it is the same posture as any CDN-served MP3, and it is what Cloudinary was already giving you.

**Signed URLs are retained for exactly one case:** unreleased tracks in `uploads-staging`, previewed by admins before publish. TTL 900s, minted per-request, cache fragmentation irrelevant at that volume.

**Does byte-range seeking survive signed URLs? Yes — verified in `supabase/storage` source, not just docs.** `src/storage/renderer/asset.ts` forwards the client's `Range` header straight to the S3 backend; `renderer.ts` sets `Accept-Ranges: bytes` unconditionally and propagates `Content-Range` and the 206 status. All three read routes — `getObject`, `getPublicObject`, `getSignedObject` — share the same `AssetRenderer`; there is no Range-blind path. `<audio>` seeking, Safari/iOS playback, and progressive scrub all work on private-bucket signed URLs. Two caveats: **never append `?download`** (sets `Content-Disposition: attachment`, turning playback into a file save), and client aborts on seek return **HTTP 499**, which is normal but will pollute logs and any naive error alerting.

So the public-bucket decision is driven purely by CDN economics, not by any Range limitation.

**Verify empirically the moment a bucket exists:**
```bash
curl -s -o /dev/null -D - -H "Range: bytes=0-99" \
  "https://wwtglvbctakstnguqrzk.supabase.co/storage/v1/object/public/song-audio/<id>/v1/audio.mp3"
# expect: HTTP/2 206, accept-ranges: bytes, content-range: bytes 0-99/<size>
```

**Does HLS survive? No — and it does not exist today either.** Supabase Storage performs **no audio transcoding, no video transcoding, no HLS/DASH packaging, no transmuxing, no waveform extraction**. Its only media processing is *image* transformation. This is a straight capability loss versus Cloudinary and it blocks the pending HLS-streaming task outright.

What survives: serving the original MP3 with Range, which — given Range genuinely works — is a perfectly good v1 for a ~100 MB file.

What HLS would require: an external worker (ffmpeg in a container, or Mux/Transloadit) triggered by a Supabase Storage webhook, pulling the master, producing a 128k/256k AAC ladder plus segments and an `.m3u8`, writing derivatives to a **public** `song-hls` bucket. Note this cannot be a Vercel function — transcoding a 100 MB file exceeds any serverless execution budget, and nothing may continue after the response. It is a separate long-running service, which is exactly what the monolith decision removed. **Treat HLS as out of scope for this integration and re-scope it as its own project.** If it is ever built, the segment bucket must be public — per-segment signed tokens would multiply the cache-fragmentation problem by the segment count.

### 6.3 Upload flow (TUS, resumable)

1. Admin selects files in the browser. A Server Action creates `UploadJob` + `UploadJobItem` rows (`status = PENDING`, `expiresAt = now + 55min`).
2. Browser POSTs to `/api/uploads/signed-token`. That handler calls `requireAdmin()`, then `supabaseAdmin.storage.from('uploads-staging').createSignedUploadUrl(stagingKey(jobId, itemId, ext), { upsert: true })` and returns `data.token`. **The service key never leaves the server.** Token TTL is 2 hours (hardcoded in storage-js).
3. Browser uploads with `tus-js-client`:

```ts
const upload = new tus.Upload(file, {
  endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL}/storage/v1/upload/resumable`,
  headers: {
    authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}`,
    'x-signature': token,
    'x-upsert': 'true',
  },
  uploadDataDuringCreation: true,
  removeFingerprintOnSuccess: true,
  chunkSize: 6 * 1024 * 1024,          // MANDATORY, EXACTLY 6MB.
  retryDelays: [0, 3000, 5000, 10000, 20000],
  metadata: {
    bucketName: 'uploads-staging',
    objectName: stagingKey(jobId, itemId, ext),
    contentType: file.type,
    cacheControl: '31536000',
  },
  onProgress: (sent, total) => void persistProgress(itemId, sent, total),
})
upload.findPreviousUploads().then(p => { if (p.length) upload.resumeFromPreviousUpload(p[0]); upload.start() })
```

`chunkSize` is not a tuning knob — Supabase's docs say verbatim it must be 6 MB. tus-js-client defaults to `Infinity`. **Forgetting this line is the single most common integration failure.** Also: one client per upload URL; a second concurrent attempt gets `409 Conflict`.

4. On completion the **browser** POSTs `/api/uploads/[jobId]/finalize`. This must be client-driven — a Vercel function cannot do work after its response, so there is no "fire and forget then finalize" option.
5. `finalize` runs `requireAdmin()`, extracts metadata, then for each item copies `uploads-staging/{jobId}/{itemId}.mp3` → `song-audio/{songId}/v1/audio.mp3` via `supabaseAdmin.storage.from(...).copy()` (server-side, no bytes transit the function), creates the `Song` row in a transaction, deletes the staging object, sets `UploadJob.status = COMPLETED`, and **then** calls `revalidateTag('songs')` + `revalidateTag('songs:list')` once for the whole job.
6. A cron (Vercel Cron, daily) sweeps `uploads-staging` objects older than 24h with no completed job.

**Expiry:** assume **1 hour** for the TUS session. Supabase's docs say the upload URL is valid up to 24 hours; the OSS default `TUS_URL_EXPIRY_MS` is 1 hour. Hosted probably overrides to 24h, but the pessimistic assumption produces resumable jobs and the optimistic one produces permanently-orphaned ones. Measure against the live project and widen if confirmed.

### 6.4 RLS on `public` — the Prisma migration

Applied by `migrate deploy` as the `prisma` role, which owns these tables. Ships as defense in depth for the PostgREST endpoint; it is **not** the app's authorization layer (§6.5).

The full policy set from the caching/RLS research applies, with these corrections for this architecture:

- `is_admin()` and `app_user_id()` read **JWT claims only**, never `public.users`. Reading `users` inside a policy on `users` produces `ERROR: 42P17: infinite recursion detected in policy for relation "users"` — which does **not** fail at `CREATE POLICY` time. It deploys clean and breaks login. The `users` "select own row" policy needs no subquery at all: `supabase_user_id = (select auth.uid())` is a plain column comparison. Recursion only ever appears in the "admins see everyone" branch, which the JWT claim eliminates.
- Every predicate wraps the helper in a scalar subquery: `(select public.is_admin())`, not `public.is_admin()`. This makes Postgres evaluate it **once per statement** as an InitPlan instead of once per row — on a 100k-row `songs` table that is the difference between 3 ms and 3 s. Supabase's linter flags the unwrapped form as `auth_rls_initplan`.
- Every policy carries an explicit `TO authenticated` / `TO anon`.
- **`songs_select_public` must include `TO anon`** — the catalog serves logged-out visitors. `auth.uid()` returns NULL for `anon`, and `NULL = user_id` is NULL, not true, so the owner-scoped policies fail closed correctly.
- **The column-grant pair on `users` is load-bearing, not decoration.** RLS is row-level, never column-level; `users_update_own` alone lets any user set their own `role` to `ADMIN`:
  ```sql
  revoke update on public.users from authenticated;
  grant  update (first_name, last_name, profile_image_url) on public.users to authenticated;
  ```
  This is the most commonly missed line in a Supabase RLS setup.
- `webhook_events` gets RLS enabled and **zero policies** → fully sealed, service-role only.
- The custom access token hook (which stamps `user_role` and `app_user_id` into the JWT) goes in `supabase/sql/`, applied as `postgres`, and is only meaningful **after** Supabase Auth is primary. Until then the policies deny by default, which is correct.
- Accept the hook's trade-off: a claim baked at issuance means **a role change does not take effect until the token refreshes** (~1 hour). Mitigate by calling `auth.admin.signOut(userId, 'global')` on any `users.role` write. Do **not** "fix" it by reading `users` in the policy — that lands you back on the recursion.

### 6.5 Storage RLS — and what it actually protects

Storage policies (`supabase/sql/03_storage_policies.sql`, applied as `postgres`) follow the read-authenticated / write-admin pattern. Note that `upsert` requires `SELECT` + `INSERT` + `UPDATE`, and the TUS flow sends `x-upsert: true` — grant all three or resumes fail confusingly.

**State plainly what these policies do and do not do in this architecture:**

- **They do nothing for our uploads.** The service-role key bypasses RLS entirely. Every storage write in this design goes through `supabaseAdmin`. Real enforcement is `requireAdmin()` in `/api/uploads/signed-token` and `/api/uploads/[jobId]/finalize`.
- **They do nothing for playback**, because `song-audio` is public by design.
- **They matter for exactly one thing:** if `uploads-staging` is ever reached directly from the browser with the publishable key. That is a real internet-facing endpoint and the policies are the only thing standing there.
- **RLS is checked when a signed URL is minted, not when it is used.** Once issued, the URL bypasses RLS entirely — an authorization *snapshot*. Demoting a user does not kill URLs they already hold, and **there is no revocation API**. Short TTLs (900s) are the only lever.

The same asymmetry applies to `public` tables and is worth stating as the team rule:

> **RLS is the backstop, not the authorization layer. Every `where` clause must be written as if RLS does not exist — because on the Prisma path, it does not.**

Prisma connects as `prisma`, which has `BYPASSRLS`. A `playlist.findMany({})` with a forgotten `where: { userId }` returns every playlist of every user and RLS will not save you. Enforce structurally: every repository function takes a required `actor: Actor` parameter so omission is a **compile error**, not a review miss; the actor comes only from `getActor()`, never from a body, param, or header; `findOne` returns 404 (not 403) for a resource you do not own, so ids are not enumerable.

**One genuinely useful property of the `prisma`-owned-tables setup:** tables created by the `prisma` role are owned by `prisma`, and the `alter default privileges … for role postgres` grants do not cover them. So `anon` and `authenticated` have **no grants at all** on the app tables, and PostgREST returns `permission denied` *before* RLS is even consulted. RLS becomes a second layer behind a closed door. `supabase/sql/04_postgrest_lockdown.sql` makes this explicit rather than incidental. The corollary: if you ever take the §3.4 escape hatch and read the catalog via PostgREST, you must add `grant select on public.songs, public.artists, public.albums to anon, authenticated;` — and at that moment the RLS policies stop being theoretical.

---

## 7. Implementation sequence

Legend: **[IRR]** irreversible · **[LIVE]** requires a live database · **[$]** requires the Pro plan · **[UI]** dashboard action, not code.

### Phase 0 — Credential hygiene (do first, blocks everything)

1. **[IRR][UI] Rotate the leaked database password.** Dashboard → Project Settings → Database → Reset database password. Invalidates all existing credentials. **Do this before writing any `.env.local`.**
2. Verify the leak is not in git: `git log -p --all -S'<leaked-password>' | head` must be empty. `git check-ignore -v .env.local` must print a rule; if not, fix `.gitignore` first.
3. **[UI][$] Confirm the plan is Pro.** Free's 50 MB object cap makes the storage phase impossible. Also confirm the region (the IPv6 block suggests ap-south-1 / Mumbai — verify, don't infer).
4. **[UI]** Check Dashboard → Authentication → JWT Signing Keys. If the project is on the legacy HS256 shared secret, migrate to asymmetric signing keys now, before any auth work. This is unresolved from the research and is decisive for anything that verifies tokens locally.
5. **[UI]** Copy the pooler hostname **verbatim** from Dashboard → Project Settings → Database → Connection string. Do not guess `aws-0` vs `aws-1`.

### Phase 1 — Repo restructure (reversible, no database)

6. Branch. Move `frontend/src` → `src`, `packages/database/prisma` → `prisma`, `packages/shared/src` → `src/lib/schemas`. Delete `backend/`. Collapse `package.json`, remove `workspaces`. Drop `mongoose`, `next-auth`, `bcryptjs`.
7. Add `@supabase/supabase-js`, `@supabase/ssr`, `tus-js-client`.
8. Update `binaryTargets` to `["native", "rhel-openssl-3.0.x"]`, remove the custom `output`, add `directUrl` to the datasource. Set `"build": "prisma generate && next build"`.
9. **Fix the Clerk webhook retry loop** (§4.4). This is a live production defect and is independent of everything else — ship it as its own PR if convenient.
10. `npx prisma validate` (no network). `npm run build` locally. Verify: app builds, all 14 existing routes still resolve.

### Phase 2 — Database (irreversible, live)

11. **[IRR][LIVE][UI] Create the `prisma` role** via `supabase/sql/00_create_prisma_role.sql` in the SQL Editor. Generate its password with a real generator — it is a **second** secret, separate from the postgres password just rotated. Skipping this means a stray `migrate reset` really can delete every Supabase Auth user.
12. Write `.env.local` (§1). Also set the same vars in Vercel — **including `DATABASE_URL` in the Build environment.**
13. **[LIVE]** Prove connectivity, read-only: `npx prisma db execute --url "$DIRECT_URL" --stdin <<< "select 1;"`. `Tenant or user not found` → wrong username format or wrong `aws-N`/region. `P1001` → wrong host or blocked egress.
14. **[LIVE]** `npx prisma migrate status`. Expect **Case A** — "No migration found in the database" — since no database has ever been reached. If it instead shows existing tables with no history (Case C), baseline **exactly the first three** migrations with `migrate resolve --applied` and let `deploy` run the fourth; the upload-tables migration has never been applied anywhere.
15. **[LIVE]** Dry run, read-only:
    ```bash
    npx prisma migrate diff --from-url "$DIRECT_URL" \
      --to-schema-datamodel prisma/schema.prisma --script > /tmp/pending.sql
    ```
    **Read this file.** If it contains any `DROP TABLE`, `DROP SCHEMA`, or a reference to anything outside `public`, **stop** — the `?schema=` param or the role's scope is wrong.
16. **[IRR][UI]** Enable PITR (Dashboard → Database → Backups) before the first write. On Free/without PITR, `pg_dump "$DIRECT_URL" --schema=public --no-owner --no-acl -Fc -f ~/preflight-$(date +%Y%m%d).dump`.
17. **[IRR][LIVE] `npx prisma migrate deploy`.** This is the DDL write. Applies all four existing migrations. `migrate deploy` never resets, never prompts, never uses a shadow DB. If it fails partway, fix forward and use `migrate resolve --rolled-back <name>` — **never** reach for `migrate reset`.
18. **[LIVE]** Verify: `npx prisma migrate status` → "Database schema is up to date!".
19. **[LIVE][UI]** Apply `supabase/sql/01_extensions.sql` (pg_trgm + the title GIN index) as `postgres`.
20. **[LIVE]** Smoke-test the **runtime** path (6543), which steps 13–18 never exercised: `npm run build && npm run start`, then hit a catalog route under concurrency — `for i in {1..50}; do curl -s localhost:3000/api/get-songs & done`. `prepared statement "s0" already exists` appearing here means `pgbouncer=true` is missing from `DATABASE_URL`. It **only** appears under parallelism.

### Phase 3 — Caching (reversible)

21. Add `src/lib/cache/{tags,catalog,revalidate}.ts`. Convert the catalog list + detail Server Components to use them. Add the ESLint `no-restricted-imports` rule.
22. Wire `revalidateTag` into every mutation per §5.4, **after commit**.
23. Run the per-user leakage test (§5.5 R5) against a **production build**. It will not reproduce in `next dev`.

### Phase 4 — Storage (irreversible once objects exist)

24. **[LIVE][UI]** Apply `supabase/sql/02_storage_buckets.sql` and `03_storage_policies.sql` as `postgres`.
25. **[LIVE]** Verify Range on a real object with the `curl` in §6.2. Expect `206` + `accept-ranges: bytes`.
26. **[LIVE]** Measure the actual TUS session expiry. Start an upload, pause 70 minutes, attempt resume. Record the answer; adjust `UploadJob.expiresAt`.
27. Build `src/lib/storage/*`, `/api/uploads/signed-token`, `/api/uploads/[jobId]/finalize`, the TUS client wrapper. Behind `NEXT_PUBLIC_STORAGE_PROVIDER`.
28. **[IRR]** Backfill: copy existing Cloudinary assets into `song-audio` / `song-covers` at versioned paths, dual-write `Song.audioUrl`. Keep Cloudinary URLs readable throughout.
29. Flip `NEXT_PUBLIC_STORAGE_PROVIDER=supabase`. Watch playback error rates and CDN `cf-cache-status` for a week.
30. **[IRR]** Only then: delete Cloudinary assets, remove `cloudinary` + `next-cloudinary`, revoke the Cloudinary API secret.

### Phase 5 — RLS (low risk, high value)

31. Author `prisma/migrations/*_enable_rls/migration.sql` against a **local throwaway Postgres**. `migrate deploy` it. **[IRR][LIVE]**
32. **[LIVE]** Verify with the `set_config('request.jwt.claims', …, true)` + `set local role authenticated` impersonation block in a transaction you `rollback`. Assert on **affected row counts**, not on exceptions: a denied `UPDATE`/`DELETE` returns "0 rows affected", silently — only `INSERT`/`WITH CHECK` violations raise `42501`.
33. **[UI]** Run the Supabase linter; expect zero `rls_disabled_in_public`, `policy_exists_rls_disabled`, `auth_rls_initplan`.

### Phase 6 — Supabase Auth, additive (reversible until step 40)

34. **[IRR][LIVE]** `migrate deploy` the `supabase_user_id` column migration.
35. Build `src/utils/supabase/{client,server,middleware,admin}.ts`, `src/middleware.ts`, `src/lib/auth/{current-user,link-identity}.ts`, `src/app/auth/callback/route.ts`.
36. Refactor every Server Action / Route Handler to call `requireActor()` / `requireAdmin()` instead of reading Clerk directly. **Clerk still resolves first** (`AUTH_PRIMARY=clerk`). Verify nothing about the existing login changes.
37. **[UI]** Enable Google OAuth in Supabase with your own client ID/secret, redirect URI `https://wwtglvbctakstnguqrzk.supabase.co/auth/v1/callback`. Ship `/sign-in-supabase` behind `NEXT_PUBLIC_AUTH_SUPABASE_ENABLED=true`. Test with a fresh account **and** with an account whose email already exists from Clerk — the second case is the one that exercises `linkSupabaseIdentity`.
38. **[LIVE][UI]** Apply the custom access token hook, enable it (Dashboard → Authentication → Hooks). Re-run the §32 RLS verification with real Supabase-issued tokens.
39. **[IRR][LIVE]** Bulk-migrate users: export from Clerk (Settings → User Exports → CSV, which carries `password_digest` / `password_hasher`), verify every hasher value is bcrypt or argon2, dedupe by lowercased email, then `auth.admin.createUser({ email, password_hash, email_confirm: <only if Clerk had verified it>, app_metadata: { role, legacy_clerk_id } })` in rate-limited batches. Write each returned id into `users.supabaseUserId`. Google users need nothing migrated — they re-consent once.
40. Flip `AUTH_PRIMARY=supabase`. Soak for at least one full session lifetime.
41. **[IRR]** Only after a clean soak: remove `@clerk/nextjs`, delete the Clerk webhook route, revoke Clerk keys.

---

## 8. Risks

### 8.1 Data-loss risks — Prisma migrations against a Supabase database

Supabase's `auth`, `storage`, `realtime`, `graphql`, `vault`, `pgsodium`, `supabase_migrations`, and `_realtime` schemas live in the **same `postgres` database** as `public`. Prisma has commands that will happily take them out.

| Command | Blast radius | Guard |
|---|---|---|
| **`prisma migrate reset`** | On a hosted DB where `DROP DATABASE` is not permitted, it performs a **soft reset**: drops every object it considers in scope. Run as a superuser-adjacent role, that means **every Supabase Auth user, every Storage object row, every Realtime subscription.** Recovery is PITR or recreating the project. | The dedicated non-superuser `prisma` role (step 11) makes this fail with *permission denied on `auth`* instead of succeeding. **This is the single most valuable line item in the whole plan.** Additionally: never add a `migrate:reset` npm script. |
| **`prisma db push --force-reset`** | Identical destruction, **with no confirmation prompt.** | Never run. Never script it. |
| **`prisma migrate dev`** | Not destructive by itself, but it needs a shadow DB and **offers to reset the moment it detects drift** — a stray `yes` executes the row above. It will also generate `DROP TABLE` for anything in `public` your schema does not declare. | Never point it at Supabase. Author migrations against a local throwaway Postgres; ship with `migrate deploy` only. Keep `DIRECT_URL` pointed at localhost in whatever env runs `migrate dev`. |
| **`prisma db push --accept-data-loss`** | Silent column/table drops in `public`, no migration file, no record. | Never run. |
| **`prisma db pull`** | Overwrites `schema.prisma` from the database, destroying every hand-written `@map`, `@@map`, comment, `binaryTargets`, and generator config. Not data loss, but source loss. | Use `migrate diff` to inspect — it is strictly read-only. |
| **`previewFeatures = ["multiSchema"]` + `schemas = ["public","auth"]`** | Triggers prisma#17734: `migrate dev` replays history in a shadow DB then tries to drop `auth`, fails partway with `cannot drop table auth.users because other objects depend on it` (dependents are `storage.buckets_owner_fkey` and `storage.objects_owner_fkey`), leaving a wrecked database. | Never enable. Without `multiSchema`, Prisma is blind to everything outside `?schema=public` — introspection, diff, and deploy all. Pin `?schema=public` on both URLs so a changed `search_path` cannot widen its scope. |
| **Any FK from a Prisma model to `auth.users`** | Not immediate loss, but permanent unresolvable drift as GoTrue ships its own migrations. Every subsequent `migrate` run reports drift and pressures someone toward `reset`. | `supabase_user_id` is a bare `UUID` with a unique index and **no** `REFERENCES`. |
| **Enabling the IPv4 add-on** | It is not dual-stack — enabling it **replaces the AAAA record with an A record**, instantly breaking anything currently connecting over IPv6 to the direct host. | Not needed. Everything goes through the pooler, which already has A records. |

### 8.2 Availability and correctness risks

| Risk | Manifestation | Mitigation |
|---|---|---|
| `pgbouncer=true` omitted | `prepared statement "s0" already exists`, intermittent, **only under concurrency**. Passes every local test. | The §20 concurrency smoke test is mandatory before the first production deploy. |
| Connection exhaustion at scale | `P2024` pool timeouts, `too many clients` | `connection_limit=1` + transaction mode + the catalog cache. Escape hatch: move the hottest anonymous read to PostgREST (§3.4). |
| First `migrate deploy` hangs | `Timed out trying to acquire a postgres advisory lock`, possibly **after partially applying DDL** | `directUrl` in the datasource is the fix and is currently missing — the highest-risk gap in the repo today. |
| Vercel build has no `DATABASE_URL` | `generateStaticParams` fails at build; or worse, silently renders zero static pages | Set it in the Build environment, not just Runtime. |
| Wrong `binaryTargets` | Green build, runtime crash on first request | Set `rhel-openssl-3.0.x`. |
| Per-user data in `unstable_cache` | One user's playlists served to everyone, persisted across deploys | ESLint confinement + the production-build leakage test. **Does not reproduce in `next dev`.** |
| `getSession()` instead of `getUser()` | Forged/stale cookie accepted as a valid session | ESLint ban in server code. |
| `SUPABASE_SECRET_KEY` reaches the bundle | Total compromise: BYPASSRLS on every table plus the Auth admin API (create/delete any user, change any email → takeover of anyone) | `import 'server-only'` + the `next.config.ts` build-time assertion. Supabase's own defense — a 401 for secret keys sent with a browser User-Agent — is a User-Agent check and is trivially bypassed by any non-browser client. Treat it as an accident net, not a control. |
| Signed URLs leak | No revocation API exists; the documented remedy is "contact Supabase support" | Short TTLs (900s) on the only place we use them (`uploads-staging`). Released catalog is public anyway. |
| Signed URLs used for playback | Every play is a CDN MISS pulling ~100 MB from origin; every seek re-fetches. Measurably worse than today. | Public bucket for released catalog. This is the decision to defend in review. |
| Free plan | 100 MB uploads rejected outright | Confirm Pro in Phase 0. |
| Object overwritten in place under `max-age=31536000` | Stale audio served indefinitely (standard CDN has no invalidation; Smart CDN still takes up to 60s) | Immutable versioned paths, always. |
| TUS `chunkSize` not set | Uploads fail; tus-js-client defaults to `Infinity` | Exactly `6 * 1024 * 1024`. |
| TUS expiry assumed 24h, actually 1h | Orphaned upload jobs that can never resume | Assume 1h until measured. |
| Role change doesn't take effect | Demoted admin stays admin for up to a token refresh (~1h) | `auth.admin.signOut(userId, 'global')` on every `users.role` write. Do not "fix" it by reading `users` in the policy. |
| RLS recursion on `users` | `ERROR: 42P17: infinite recursion` — **deploys clean, breaks login at query time** | JWT-claim helpers only; no table reads in policies on `users`. |
| `users_update_own` without column grants | Any user promotes themselves to ADMIN | The `revoke update` / `grant update (cols)` pair. |
| HLS assumed to survive | Task blocked with no owner and no plan | Stated explicitly: Supabase contributes nothing. Re-scope as a separate project requiring a long-running worker — which the monolith decision removed. |
| Clerk webhook retry loop recurs | Svix retries a permanently-failing event; alert noise; a user permanently missing from `public.users` | Link-don't-insert + 2xx-on-permanent-error + `WebhookEvent` dead-letter with a unique `providerEventId`. Same code path reused for Supabase. |

### 8.3 Open items that need a live project to close

1. **JWT signing keys** — is this project on asymmetric keys or the legacy HS256 secret? Decisive for anything that verifies tokens locally. Check the dashboard before Phase 6.
2. **Region and pooler hostname** — `aws-0` vs `aws-1`, and the region. Copy verbatim; both prefixes accept TCP, so a successful `nc` proves nothing.
3. **TUS session expiry** — 1h or 24h. Measure in step 26.
4. **Clerk CSV column names** — `password_digest` / `password_hasher` are documented by third-party importers, not by Clerk. Verify against a real export, and check every hasher value is bcrypt or argon2.
5. **Legacy `anon`/`service_role` key deprecation date** — the migration guide suggests end of 2026 but does not restate it as a dated commitment. Prefer the new `sb_publishable_` / `sb_secret_` formats now regardless; confirm the date in the dashboard before planning around it.
6. **Supavisor pool size for this project** — the default is ~15 server connections per tenant. Confirm in Dashboard → Database → Connection pooling and raise it if peak concurrency warrants.