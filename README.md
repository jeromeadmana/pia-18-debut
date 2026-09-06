# Pia — 18th Birthday Debut

A premium debut invitation and guest-management system: private invite links,
multi-guest RSVP, seating lookup, the 18s court (Roses / Candles / Treasures),
and a moderated guestbook.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind 4 · Drizzle ORM ·
Neon Postgres · Cloudinary · Vercel Hobby

---

## Setup

```bash
pnpm install
neon auth                 # browser OAuth, or export NEON_API_KEY
neon link --project-id proud-violet-47036262 --branch production \
          --org-id org-falling-thunder-21973411 -y
```

`neon link` writes `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH`
into `.env.local`, which is gitignored. There is no separate `env pull` step.

Then **append** the two admin values to that same `.env.local` — do not copy
`.env.example` over it, that would wipe the Neon credentials:

```bash
node -e "console.log('ADMIN_SESSION_SECRET='+require('crypto').randomBytes(32).toString('hex'))" >> .env.local
echo "ADMIN_PASSWORD=pick-something-memorable" >> .env.local
```

Both fail closed when unset: `/admin` locks everyone out rather than letting
anyone in. See `.env.example` for the full list of keys.

```bash
pnpm db:migrate   # apply schema
pnpm db:seed      # demo invites — safe to re-run
pnpm dev
```

Demo invite links: `/i/DEBUT2`, `/i/DEBUT3`, `/i/DEBUT4`.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` / `build` / `lint` | Next.js |
| `pnpm db:generate` | Generate a migration from `db/schema.ts` |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:seed` | Idempotent seed |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:latency` | Time the hot read path against the 10s ceiling |
| `pnpm test` | Vitest (integration tests skip without `DATABASE_URL`) |

> Run `pnpm build` before `tsc --noEmit` on a fresh clone — Next generates the
> route types that `PageProps<"/i/[code]">` depends on.

---

## Architecture

### Guest access is code-only

An invite is a **party, not a person**: one `rsvp_code`, one row in `invites`,
N rows in `guests`. Guests reach their details only through the secret in their
link. There is no public name search — that would make the entire guest list
enumerable. `searchGuestsByName` exists for admin use and is deliberately not
routed anywhere.

Malformed and unknown codes return the **identical** 404, so the endpoint cannot
be used to probe which codes exist.

### Staying inside Vercel Hobby

| Surface | Strategy |
|---|---|
| `/rsvp`, `/live`, `/admin/login` | Static — zero DB, zero functions |
| `/` | ISR, 15 min — reads the event phase, so it cannot be built once |
| `/court` | ISR, 5 min — one render serves every guest |
| Countdown, live programme | Client-side — never a server call |
| `/i/[code]`, `/admin` | Dynamic, indexed round trips |
| `/api/*` | Route handlers, `maxDuration = 10` |

`/live` is the page guaranteed to spike on the night, and it is deliberately
the page that touches nothing: static HTML plus a client-side clock.

Measured: warm lookup ~300 ms; ~9.3 s of headroom on the first request.

### Two constraints worth knowing before you edit `db/`

1. **No interactive transactions.** neon-http cannot do `db.transaction()`.
   Multi-statement writes use `db.batch([...])` — one atomic round trip.
2. **`withRetry` is for reads only.** A write that timed out may have landed.
   Write idempotency comes from unique constraints instead.

### The event has four phases

`lib/phase.ts` derives **countdown → final-week → event-day → past** from
`event.date.iso`, so nothing needs switching on by hand. The home page
revalidates every 15 minutes and changes its primary action accordingly; once
the deadline passes the RSVP form is replaced by a summary of what was recorded.

### Admin

`/admin` is gated in two independent places. `proxy.ts` (Next 16's rename of
middleware) pre-filters `/admin/*` and `/api/admin/*` by prefix, so a new admin
route is covered by default. Every admin page and route handler then re-verifies
the session through `lib/admin-session.ts`, next to the data — Next's own
guidance is that Proxy "should not be your only line of defense", since it also
runs on prefetches.

Auth is one shared password exchanged for an HMAC-signed httpOnly cookie holding
only an expiry and its signature.

`searchGuestsByName` lives behind this gate for a reason: exposed publicly it
would make the whole guest list enumerable, defeating the invite-code design.

Rate limiting (`lib/rate-limit.ts`) is **per-instance and best-effort** —
Vercel isolates share no memory. It stops double-tapped submits and retry
loops, not a distributed attacker.

### Images

`next/image` delegates transforms to Cloudinary (`f_auto,q_auto`), which keeps
the gallery off Vercel's image-optimization quota. Measured: a 205 KB source
serves as 23 KB WebP at display width.

**The Cloudinary account is shared with other projects.** Everything this app
writes lives under the `pia-18-debut/` folder, and that prefix is enforced in
`lib/cloudinary.ts` rather than left as a naming convention — `scopedPublicId`
throws on any ID that tries to climb out (`../other-project/logo`). There is
deliberately **no delete helper anywhere in this codebase**: on a shared account
an errant delete is unrecoverable, so the safest design is one that cannot
express it. Remove assets from the Cloudinary console by hand.

`pnpm cloudinary:upload` pushes `public/gallery/*` into that folder. It uses
`overwrite: false`, so re-running reuses existing assets instead of clobbering
them, and prints the public IDs to paste into `event.config.ts`.

---

## Content

Everything a guest reads lives in **`content/event.config.ts`** — swap the
`REPLACE_ME` values and the whole site updates. The 18s roster lives in the
database; edit `content/court.seed.csv` and re-seed.

## Before going live

See the checklist in [`tasks/todo.md`](tasks/todo.md). The two easiest to forget:
**delete the demo invites** before loading real guests, and **pin the Vercel
function region to `iad1`** — co-locate with Postgres in `us-east-2`, not with
guests in Manila.
