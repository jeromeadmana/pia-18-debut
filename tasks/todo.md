# Pia 18th Debut — Passes 1–4

Plan: `C:\Users\jerome\.claude\plans\typed-herding-codd.md`

## Locked decisions

| Decision | Choice |
|---|---|
| Guest access | Private `rsvp_code` in the invite link (`/i/DEBUT2`). No public name search. |
| Data layer | Drizzle + `@neondatabase/serverless` HTTP driver (Neon's own Next.js guidance) |
| Content | Placeholder `content/event.config.ts`, swap-in-one-file |
| Provisioning | Neon CLI against project `proud-violet-47036262`, branch `production` |

---

## Pass 1 — complete

- [x] Scaffold Next.js 16.3.4 / React 19.2.8 / Tailwind 4 / TypeScript, pnpm
- [x] `.gitignore` verified to cover `.env*` **before** any credential existed
- [x] Neon CLI installed, authenticated, directory linked (`.neon`)
- [x] `neon config init` → `neon.ts` (empty config, infra-only)
- [x] Design tokens: ivory / champagne / rose / burgundy / gold, Cormorant + Geist
- [x] `content/event.config.ts` — every user-facing string, `REPLACE_ME` markers
- [x] `content/court.seed.csv` — 54-row drop-in roster
- [x] 7 photoshoot images imported to `public/gallery`, true dimensions recorded
- [x] Schema: 6 tables, 2 enums, 9 indexes → `db/migrations/0000`, `0001`
- [x] `db/client.ts` — neon-http + narrow `withRetry` for cold starts
- [x] `db/queries.ts` — invite lookup, RSVP submit, court, guestbook, admin search
- [x] `db/seed.ts` — idempotent, fixed demo codes
- [x] API routes `/api/rsvp`, `/api/guestbook` with `maxDuration = 10`
- [x] Pages: `/` (SSG), `/court` (ISR 5m), `/i/[code]` (dynamic), `/rsvp` (lookup)
- [x] 37 tests across unit + live-database integration
- [x] `scripts/db-latency.ts` — event-day latency probe

---

## Verification results

Every item run against the live Neon `production` branch.

| # | Check | Result |
|---|---|---|
| 1 | Schema applied | `0000` + `0001` applied; 6 tables, 9 indexes |
| 2 | **Seed idempotent** | 1st run: 3 invites / 7 guests / 54 court. 2nd run: **0 / 0**, counts unchanged |
| 3 | Invite lookup | Party + 4 guests + Table 3 in one round trip; unknown & malformed → identical `null` |
| 4 | RSVP round trip | Mixed 2 attending / 2 declined, `respondedAt` stamped, dietary note persisted |
| 4b | **Song idempotency** | Re-submit with differing case → still 1 row (unique on `lower(title)`) |
| 5 | **Cross-invite guard** | Foreign `guestId` → `unknown_guest`, victim row provably unchanged |
| 6 | Latency | first **669 ms**, warm mean **301 ms**, vs 10 000 ms ceiling |
| 7 | Validation | 37/37 tests pass |
| 8 | **Secret hygiene** | `.env.local` ignored via `.gitignore:34`; no credential fragment in any committable file |
| 9 | Build | Clean. `/` + `/rsvp` static, `/court` ISR 5m, `/i/[code]` + APIs dynamic |

**Caveat on #6:** the compute was already warm from the test run, so 669 ms is *not* a
true cold start. A real Neon resume adds ~1–2 s, putting the realistic worst case near
2.7 s. Re-run `pnpm db:latency` after ≥5 min of idle for the honest cold number.

### Test summary
```
Test Files  3 passed (3)
     Tests  37 passed (37)
  Duration  10.84s
```

---

## Pass 2 — complete

- [x] **Debut date set: Tuesday, 10 October 2028**, 6:00 PM (Asia/Manila).
      RSVP deadline pulled to 26 September 2028.
- [x] `components/RsvpForm.tsx` — per-guest accept/decline, live seat counter,
      conditional dietary notes, up to 3 song requests, inline confirmation
- [x] `components/CourtTabs.tsx` — ARIA tabs with arrow-key nav + global search
      across all categories, with match highlighting
- [x] `components/Guestbook.tsx` — wishes wall, client-fetched so `/` stays static
- [x] Home page: court teaser, gift etiquette, guestbook sections
- [x] 5 guestbook moderation integration tests

### Pass 2 verification — live HTTP against `next start`

| Check | Result |
|---|---|
| `GET /` | 200 in **26 ms** (static) |
| `GET /i/DEBUT2` | 200 in 720 ms; party, Table 3, both choice buttons render |
| `GET /i/ZZZZZZ` | **404** |
| `GET /court` | 200; all 3 categories + search present **in server HTML** (works without JS) |
| `POST /api/rsvp` valid, lowercase code | 200 `{attending:2, declined:2}` |
| `POST /api/rsvp` re-post identical | 200, song rows still **exactly 1** |
| `POST /api/rsvp` cross-invite guest id | **409 `unknown_guest`** |
| `POST /api/rsvp` unknown code | 404 |
| `POST /api/rsvp` malformed | 400 with field-level issues |
| `POST /api/guestbook` | 201 |
| `GET /api/guestbook` | `[]` — unapproved message correctly withheld |

Tests: **42 passed (4 files)**. Build, `tsc --noEmit`, ESLint all clean.
Demo data reset afterwards: 0 guestbook rows, 0 song rows, 0 non-pending guests.

---

## Passes 3–4 — complete

**Admin (`/admin`)**
- [x] `lib/auth.ts` — HMAC-signed httpOnly session cookie, constant-time compares,
      fails closed on missing/short secret or unset password
- [x] `proxy.ts` (Next 16 rename of middleware) — prefix pre-filter over
      `/admin/*` and `/api/admin/*`; pages redirect, APIs 401
- [x] `lib/admin-session.ts` — per-route re-verification, so the proxy is never
      the only guard (per Next's authentication guidance)
- [x] Dashboard: RSVP stat tiles, guest search, guestbook queue
      (approve / unpublish / delete), seating with over-capacity warnings
- [x] Admin APIs: login, logout, guests, guestbook, invites
- [x] `.env.example` committed (no values); `.gitignore` negation added so the
      template is trackable while `.env.local` stays hidden

**Event lifecycle**
- [x] `lib/phase.ts` — countdown / final-week / event-day / past, derived from
      the date; `isRsvpClosed` also closes once the event is past
- [x] Home page revalidates every 15 min and swaps its primary CTA per phase;
      post-event thank-you section
- [x] Closed-RSVP state replaces the form with a summary of what was recorded
- [x] `/live` — event-day programme, static, "now" computed client-side on a 30s
      tick, no network calls after load

**Rate limiting**
- [x] `lib/rate-limit.ts` — RSVP 10/min, guestbook 5/min, admin login 5/15min.
      Per-instance and best-effort by construction (documented in the file).

### Passes 3–4 verification — live HTTP

| # | Check | Result |
|---|---|---|
| 1 | `/admin` unauthenticated | **307** → `/admin/login?next=/admin` |
| 2 | `/api/admin/guests` unauthenticated | **401** |
| 3 | `/api/admin/invites` PATCH unauthenticated | **401** |
| 4 | Login, wrong password | **401** |
| 5 | Login, correct password | 200 + session cookie |
| 6 | `/api/admin/guests` with session | 200, returns matches |
| 7 | `/admin` with session | 200, all sections render |
| 8 | `/live` | 200, programme in server HTML |
| 9 | **Forged cookie** (valid-looking expiry, bogus signature) | **401** |
| 10 | Moderation round trip | hidden → approve → visible → delete |
| 11 | Table assignment | 200; invalid table id → **400** (FK holds) |
| 12 | Guestbook rate limit | 201×4 then **429** |

Tests: **77 passed (7 files)**. Build, `tsc --noEmit`, ESLint all clean.
Route table: `/` ISR 15m, `/live` + `/court` + `/rsvp` + `/admin/login` static,
`/admin` + `/i/[code]` + all APIs dynamic, middleware active.

Test data reset afterwards: 0 guestbook rows, 0 song rows, 0 non-pending guests,
table assignments restored.

---

## Known gaps (deliberate)

- **Rate limiting is per-instance**, not global — Vercel isolates share no
  memory. Blunts accidents and casual abuse, not a distributed attacker.
  A shared store (Upstash/Vercel KV) would make it a real control.
- Gallery is a masonry grid — no lightbox or carousel.
- Only one hero treatment built (cinematic photo wash); the minimalist and
  split-gallery variations were not built.
- Post-event state reuses the pre-debut gallery; there is no upload path for
  photographs taken on the night.
- Admin is a single shared password with no audit trail of who changed what.

---

## Before deploying

- [ ] Replace every `REPLACE_ME` in `content/event.config.ts`
- [ ] Replace the 54 `REPLACE_ME` rows in `content/court.seed.csv`
- [ ] **Delete the 3 demo invites** (`DEBUT2/3/4`) before loading the real guest list
- [ ] Upload gallery images to Cloudinary, set `publicId` + `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`
- [ ] Add `DATABASE_URL` to Vercel env vars
- [ ] **Pin the Vercel function region near the database** (Neon is `aws-us-east-2`;
      use `iad1`). Function↔DB round trips dominate, so co-locate with Postgres,
      not with guests in Manila.
- [ ] Set `ADMIN_SESSION_SECRET` and `ADMIN_PASSWORD` in Vercel env vars
      (see `.env.example`; local values are already in `.env.local`)

## Next up

- Gallery lightbox and an upload path for photographs taken on the night
- Alternate hero treatments (minimalist typography, split gallery)
- Shared-store rate limiting if the site is ever made public
- Bulk invite import + code generation from a spreadsheet of real guests
