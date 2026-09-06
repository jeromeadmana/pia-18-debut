# Resume here

Paused 6 September 2026. Working tree clean, `master` pushed, 99 tests green.

---

## Where we are

The site is feature-complete against the luxury-SaaS brief except two items, and
runs end to end against live Neon + Cloudinary.

| | |
|---|---|
| Stack | Next.js 16 · React 19 · Tailwind 4 (CSS-first, **no** `tailwind.config.ts`) · Drizzle + Neon · Cloudinary · Vercel Hobby |
| Debut | Tuesday **10 October 2028**, 6pm, Asia/Manila. RSVP closes 26 Sept 2028. |
| Repo | `github.com/jeromeadmana/pia-18-debut` (private), branch `master` |
| Design | Obsidian hero + ivory editorial body, alternating `surface-*` classes |
| Tests | 99, `pnpm test` |

Built so far: private invite codes, four-step RSVP wizard, QR guest pass, 18s
court with tabs + search, interactive programme, attire palette visualiser,
moderated guestbook with voice wishes, admin dashboard, event phases, `/live`.

---

## THE NEXT THING (recommended)

**A guest list import tool.** This is the real gap and it is not on the brief.

The database currently holds only the three hardcoded demo invites from
`db/seed.ts`:

```
DEBUT2 (The REPLACE_ME Family) · DEBUT3 · DEBUT4   — 7 guests
court: roses=18, candles=18, treasures=18, all "REPLACE_ME Rose 1"…
```

Everything works beautifully against fake data. Running the actual event means
creating ~50–100 real invites — each with a generated code, party name, seat
count and guest names — and right now that means hand-editing a TypeScript
array. That is the difference between a demo and a working tool.

Shape it as: CSV in → invites out. Reuse `generateUniqueCodes` in
[lib/codes.ts](../lib/codes.ts), make it idempotent the way `db/seed.ts` already
is (`onConflictDoNothing` keyed on `rsvp_code`), and print the invite links ready
to paste into messages. An admin view to see and re-send them would follow.

### Then, in order

2. **Real content** — 60 placeholders left; `pnpm check:content` lists them.
   Needs Jerome, not code: celebrant's full name, venue, maps link, contact,
   and the 54 court names in `content/court.seed.csv`.
3. **Pass E — printable invitation insert**, 4.75″ × 6.75″ for a 5×8 envelope.
   Use `@page` + `@media print`, not a PDF library. The print groundwork already
   exists (see the guest pass and the print block at the end of `globals.css`),
   so this is mostly layout. Reachable by guests and from `/admin`.
4. **Pass F — mocked outfit style check** inside the RSVP wizard. Least valuable
   thing remaining; the brief marks it optional.

---

## Ops items outstanding

- [ ] **`NEXT_PUBLIC_SITE_URL` is unset**, so the guest-pass QR encodes a
      *relative* path — it will not scan from another phone. Set it to the Vercel
      domain.
- [ ] **Vercel env vars**: `DATABASE_URL`, `ADMIN_SESSION_SECRET`,
      `ADMIN_PASSWORD`, `CLOUDINARY_URL`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`.
      The pnpm install failure is fixed (588e8f8) but **no deploy has been
      confirmed green since** — worth checking first thing.
- [ ] Pin the Vercel function region to `iad1` — Neon is `aws-us-east-2`, and
      function↔DB round trips dominate. Co-locate with Postgres, not with guests.
- [ ] **Delete the three demo invites** before loading real guests.
- [ ] Cotillion has no roster, so that programme segment is correctly not
      expandable. It becomes expandable on its own once names are added.

---

## Things that will bite you if forgotten

- **Run `pnpm build` before `tsc --noEmit`** on a fresh clone or after adding a
  route — Next 16 generates the `PageProps` route types at build time.
- **`allowBuilds` in `pnpm-workspace.yaml`** must list every dependency with an
  install script (`esbuild`, `unrs-resolver`) or `pnpm install` exits 1. This is
  platform-dependent and is how the first Vercel deploy died.
- **Nothing crossing the server/client boundary may be a function.** The
  `next/image` loader is global in `next.config.ts` for exactly this reason.
- **neon-http has no interactive transactions** — use `db.batch([...])`.
  `withRetry` is reads only.
- **Cloudinary is a shared account.** Everything is confined to `pia-18-debut/`,
  enforced by `scopedPublicId` which throws on `..`. There is deliberately **no
  delete path in the codebase**; remove assets by hand from the console.
- **Voice wishes count against Cloudinary's *video* quota**, not image. Watch
  that one if wishes get popular.
- Full list in [lessons.md](lessons.md) — 15 entries.

---

## Useful commands

```bash
pnpm dev                 # localhost:3000
pnpm test                # 99 tests
pnpm check:content       # what is still REPLACE_ME
pnpm db:seed             # idempotent demo data
pnpm db:studio           # browse the database
pnpm db:latency          # cold-start check vs the 10s ceiling
pnpm cloudinary:upload   # push public/gallery into pia-18-debut/
```

Secrets live in `.env.local` (gitignored, never printed). `.env.example`
documents the keys with empty values. Admin password is in `.env.local` — worth
changing to something memorable before the event.

Demo invite links: `/i/DEBUT2`, `/i/DEBUT3`, `/i/DEBUT4` · admin at `/admin`.

**Note the site is in the `countdown` phase** (766 days out), so `/live` and the
post-event state do not surface on the home page. To see them, temporarily set
`date.iso` in `content/event.config.ts` near today; `/live` is always reachable
directly.
