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

```bash
pnpm db:migrate           # apply schema
pnpm db:seed              # demo invites — safe to re-run
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
| `/`, `/rsvp` | Static — zero DB, zero functions |
| `/court` | ISR, 5 min — one render serves every guest |
| Countdown | Client-side — never a server call |
| `/i/[code]` | Dynamic, one indexed round trip |
| `/api/*` | Route handlers, `maxDuration = 10` |

Measured: warm lookup ~300 ms; ~9.3 s of headroom on the first request.

### Two constraints worth knowing before you edit `db/`

1. **No interactive transactions.** neon-http cannot do `db.transaction()`.
   Multi-statement writes use `db.batch([...])` — one atomic round trip.
2. **`withRetry` is for reads only.** A write that timed out may have landed.
   Write idempotency comes from unique constraints instead.

### Images

`next/image` delegates transforms to Cloudinary (`f_auto,q_auto`), which keeps
the gallery off Vercel's image-optimization quota. Until `publicId` is filled in
per image, files serve from `/public/gallery` with `unoptimized`.

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
