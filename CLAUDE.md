# CLAUDE.md
Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
Project instructions for Claude Code. Add your own conventions and preferences
under "Your notes" at the bottom — the sections above document how the repo
actually works today.

## What this is

Swaras — a music streaming app. Admins upload audio (ID3 tags read in the
browser, files stored in Supabase Storage), everyone can browse and listen
including signed-out visitors, and signed-in users like songs and build
playlists.

**A single Next.js 15 application.** Next.js is the backend too — Route Handlers
under `src/app/api/**`, plus Server Components. There is no separate API service.
Deploys to Vercel.

**Supabase is data, auth and storage.** Postgres via supabase-js/PostgREST (no
ORM, no connection pool, no `DATABASE_URL` at runtime), Supabase Auth for
identity, Supabase Storage for media. Row Level Security is a real part of the
authorization story, not decoration.

Prisma, Clerk and Cloudinary are all **gone**. A NestJS backend was also started
and abandoned. If you find stale references to `prisma/`, `@prisma/client`,
`@clerk/*`, `cloudinary`, `frontend/`, `backend/`, `packages/` or `@swaras/*`,
they are leftovers and should be removed, not restored.

## Layout

```
music-app/
├─ src/app/            routes + API route handlers
├─ src/components/     UI, incl. shadcn primitives in ui/
├─ src/hook/           TanStack Query hooks + axios wrappers
├─ src/hooks/          standalone hooks (useSupabaseUser, useMediaSession)
├─ src/lib/            auth guards, DTO mapping, storage paths, theme, utils
├─ src/utils/supabase/ browser / server / middleware Supabase clients
├─ supabase/migrations SQL, applied with the Supabase CLI
└─ docs/
```

## Commands

| Command              | What it does                                                |
| -------------------- | ----------------------------------------------------------- |
| `npm install`        | Install dependencies                                        |
| `npm run dev`        | Dev server (Turbopack)                                      |
| `npm run build`      | `next build`                                                |
| `npm run lint`       | ESLint                                                      |
| `npm run type-check` | `tsc --noEmit`                                              |
| `npm run format`     | Prettier                                                    |
| `npm run db:push`    | Apply `supabase/migrations/**` to the linked project        |
| `npm run db:types`   | Regenerate `src/lib/database.types.ts` from the live schema |

`db:push` and `db:types` need a linked Supabase project (`npx supabase link`).
There is no local seed script.

## Setup

1. `cp .env.example .env.local` and fill it in.
2. `npm install`
3. `npm run db:push` (once, against a linked project)
4. `npm run dev`

## Things that will bite you

These are real, load-bearing, and not obvious. Don't "clean them up" without
reading why.

- **`src/lib/storage.server.ts` is the only place that may sign a playback URL.**
  It is `server-only` and uses `SUPABASE_SECRET_KEY`, which bypasses RLS. The
  reason is not squeamishness: Storage authorizes `/object/sign/` against the
  bucket's SELECT policy, so any SELECT policy on `song-audio` lets that role
  mint its own signed URLs at any TTL. `song-audio` therefore has no SELECT
  policy except for admins. Never import that module from a client component,
  and never re-add a broad SELECT policy on the bucket.
- **Listening is public; the private bucket is about expiry, not secrecy.** The
  server signs for anonymous callers too, because `/` and `/api/get-songs` are
  public routes and signed-out visitors could always listen. What private buys is
  that URLs expire and only the server issues them. Don't write comments claiming
  more than that.
- **Sign once per listing, not per play.** A fresh signed token is always a CDN
  miss (measured); the same token caches. Re-signing per playback turns every
  seek into a cold origin fetch, which is why `AUDIO_URL_TTL_SECONDS` is hours
  and why every endpoint carrying a signed URL is `private, no-store`.
- **The TanStack Query cache must be cleared on auth changes.**
  `src/components/Providers.tsx` subscribes to `onAuthStateChange` and calls
  `queryClient.clear()` on SIGNED_IN/SIGNED_OUT. `router.refresh()` does **not**
  do this — it re-renders Server Components and deliberately preserves client
  state, so on a shared device the next user would see the previous one's
  playlists, likes and `isAdmin` for the full `gcTime`.
- **Uploads never pass through a function.** A Vercel request body caps around
  4.5MB and a track can be 100MB, so the browser uploads straight to Storage over
  TUS. `/api/upload-song` mints server-derived object paths, `/complete`
  re-reads them from `upload_job_items` and verifies the object's size. Don't
  "simplify" that into a form-data endpoint.
- **`songs.uploaded_by_user_id` is `on delete restrict`, not cascade.** Every
  song is uploaded by an admin, so cascading would delete the catalogue along
  with the user. Deactivate users (`status = 'INACTIVE'`) instead of deleting.
- **Email is not an identity.** `supabase_user_id` is the only link to an auth
  identity; nothing may match a user by email, and the signup trigger must never
  adopt an existing row (that is account takeover). `users_email_key` was dropped
  for the same reason — a unique email let a stranger squat an address at signup
  and lock out its real owner forever.
- **Never log request headers or response bodies.** A `Bearer` token in a console
  log is a session handed to anyone reading the browser console.

## Conventions

- **Every user id comes from the verified session, never from a request body or
  query param.** `requireUser()` / `requireAdmin()` / `optionalUser()` in
  `src/lib/auth.ts` are the only way to learn who the caller is. The four IDOR
  bugs that used to be here are fixed — don't add a fifth.
- **Roles are read live from `public.users.role`**, never from a JWT claim: a
  claim freezes at signup and survives a demotion.
- Request validation is zod. Define a schema once and reuse it; don't hand-roll
  `if (!x)` checks.
- List endpoints return `{ items, pagination }`. `limit` is clamped server-side.
- Errors return `{ success: false, message }`. Never echo an exception message
  to the client on a 500.
- Migrations are append-only. A file that has been applied to the live project is
  history: correct it with a NEW migration, never by editing it in place.
- Prettier: single quotes, 2-space, 100 cols, `arrowParens: avoid`. Run
  `npm run format`.

---

## Your notes

<!-- Yours. Nothing above this line is user-authored; add project preferences here. -->
## Design System

Target reference: `Pulse-Music-Listener-Admin.png` (a "Pulse" music app mockup).
**Light theme only — there is no dark mode.** Values below were pixel-sampled
directly from the reference image (not eyeballed), so they should be treated as
exact. If you retheme again from a new screenshot, resample rather than reusing
these — don't assume they still apply.

### Fonts
- **Single family for everything** — headlines, headings, nav labels, and body/UI
  text in the reference are all the same bold geometric sans at different weights,
  not two separate families.
- Font: **'Poppins', system-ui, -apple-system, sans-serif** — weights 400 (body),
  500 (labels/meta), 600–700 (nav, card titles, sub-headings), 800 (hero headline).
  Poppins is already loaded in this app (`next/font/google`) and is the closest
  real, freely-licensed match to the reference's letterforms (tall x-height,
  circular counters, double-story 'a', open-tail 'g'). **This is a best-effort
  visual match, not a confirmed font identity** — exact font ID isn't derivable
  from a raster image. If you have the real font name (e.g. from a Figma source),
  swap it in; otherwise Poppins stands.
- Code: 'JetBrains Mono', Menlo, Monaco, monospace (unchanged — no code UI in the
  reference to sample from)

### Colors
- background (page): **#F5F4EE** (warm cream)
- card / surface-1 (search bar, pills, input fields — lightest surface): **#FBFAF5**
- secondary / muted surface (active nav pill, hover rows, "now playing" card,
  highlighted list rows): **#E7EBE3** (pale sage)
- foreground (primary text/headings): **#1E2A2A** (near-black, teal-charcoal —
  not pure black)
- muted-foreground (secondary text — artist names, meta, timestamps):
  **rgba(30,42,42,0.6)** (renders ≈ #747A78 on the cream background)
- border: **rgba(30,42,42,0.12)** (renders ≈ #DBDBD6)
- primary (hero/feature cards, large CTA surfaces — the deep forest green):
  **#274747**
- primary-foreground (text/icons on primary): **#F7EFE6**
- brand accent (hearts, links, "See all", progress fill, headline highlight word):
  **#D46E49** (terracotta/burnt-orange — confirmed via multiple clean flat-fill
  samples, e.g. the filled heart icons)
- brand accent light (button fills like "Play session", the "+" add circle —
  icon/text on top is primary-colored, not white): **#F5C1A5**
- brand accent dark (hover/active state — not present in the reference at full
  size, derived by darkening the accent ~20%): **#B35A3A**
- sidebar: **#FBFAF5 (card) with a right border** in `border`. It was originally
  specced as the same cream as the page "split only by a border", but the border
  was never applied and the two surfaces are byte-identical, so the rail was
  invisible. Note it must NOT use the pale-sage secondary — that is the active
  nav pill's colour, and tinting the whole rail with it erases the indicator.
- surface-0: alias for background, #F5F4EE
- surface-1: alias for card, #FBFAF5
- surface-2: alias for secondary/muted, #E7EBE3
- surface-3 (rarely-needed third elevation step, derived): **#DEE2D8**

### Other tokens
- Border radius: base 1rem; scale — pills/badges/buttons = fully rounded (9999px),
  song rows/inputs ≈ 0.75–1rem, feature/hero cards ≈ 1.5–2rem
- Focus/ring color: #D46E49
- Card shadow: 0 1px 3px rgba(30,42,42,0.06), 0 4px 16px rgba(30,42,42,0.04)
- Card hover shadow: 0 4px 20px rgba(30,42,42,0.10), 0 8px 40px rgba(30,42,42,0.06)
- Selection/scrollbar accent: rgba(212,110,73,0.25)

### Style summary
Warm, light, editorial-feeling design system built on Poppins at varying weights
(no separate display/body families). Cream page background (#F5F4EE) with a
near-white card surface (#FBFAF5) and a pale-sage muted surface (#E7EBE3) for
active/elevated states. Near-black teal-charcoal text (#1E2A2A), never pure
black. A deep forest green (#274747) is the second major surface color — used
for hero/feature cards and "now playing" emphasis, not just an accent. A single
terracotta accent (#D46E49, light tint #F5C1A5) marks likes, links, and
highlighted words. Generously rounded corners (fully pill-shaped buttons/badges,
large 1.5–2rem radii on feature cards), soft warm-toned shadows, no dark mode.