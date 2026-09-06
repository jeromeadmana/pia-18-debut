# Lessons

Anti-patterns hit during this project and the rules that prevent a repeat.
Review at the start of each session.

---

### 1. Fixture data must satisfy the app's own validation

**Anti-pattern:** Seeded demo invite codes `PIA234/5/6` — but `CODE_ALPHABET`
deliberately excludes `I`. `isValidRsvpCode` would have rejected them before any
database hit, so every demo link 404'd while the rows sat there perfectly valid.

**Rule:** When a validator and a fixture describe the same value, the fixture is
not "test data" — it is an input to the validator. Assert fixtures against the
real validator, or derive them from its generator. Caught here by reading the
alphabet; it should have been caught by construction.

---

### 2. `neon.ts` is infrastructure, not schema

**Anti-pattern:** Assuming `neon deploy` would create tables.

**Rule:** `neon.ts` / `@neon/config` declares *services and branch policy*
(auth, Data API, Functions, Storage, TTL, compute). Migrations are out of scope —
Drizzle owns `db/schema.ts` + `db/migrations/`. Also: `neon link` **already pulls**
`DATABASE_URL` / `DATABASE_URL_UNPOOLED` / `NEON_BRANCH` into `.env.local`; a
separate `neon env pull` is not required. An empty `defineConfig({})` deploy is a
genuine no-op and injects nothing.

---

### 3. neon-http has no interactive transactions

**Rule:** `db.transaction(async (tx) => …)` does not exist on the HTTP driver.
Multi-statement writes go through `db.batch([...])`, sent as one atomic round trip.
This is a hard architectural constraint, not a preference — it shapes how every
write in `db/queries.ts` is composed. Never introduce `db.transaction` here.

---

### 4. Never retry a write on timeout

**Rule:** `withRetry` in `db/client.ts` is for **reads only**. A write that timed
out may already have landed; replaying it duplicates rows. Writes get their
safety from unique constraints instead (`song_requests_invite_title_uq`), which
turns a replay into a no-op rather than a duplicate.

---

### 5. Scope every write by the resource the caller proved they hold

**Anti-pattern risk:** `UPDATE guests SET … WHERE id = $submittedId`. Anyone with
one valid invite code could rewrite any other guest's RSVP by guessing an integer.

**Rule:** Validate ownership up front **and** carry the ownership predicate into
the `WHERE` clause (`AND invite_id = <this invite>`). Two independent guards,
because either alone is one refactor away from being bypassed. Covered by the
"refuses a guest id belonging to a different invite" test — keep that test.

---

### 6. Toolchain specifics on this machine

- **pnpm 11** ignores the `pnpm` field in `package.json`. Build-script approval
  lives in `pnpm-workspace.yaml` under `allowBuilds: { esbuild: true }` — note the
  key is `allowBuilds`, *not* the older `onlyBuiltDependencies`. Until it is set,
  `pnpm <script>` fails its dep-status precheck with `ERR_PNPM_IGNORED_BUILDS`.
- **tsx** treats `.ts` as CJS without `"type": "module"`, so **top-level `await`
  is a transform error**. Use `tsx --env-file=.env.local` for env loading rather
  than `dotenv` + `await import()`.
- **Next 16** generates route types (`PageProps<"/i/[code]">`) during
  `next build` / typegen. `tsc --noEmit` fails on a newly added route until a
  build has run — build first, then typecheck.
- **React 19 lint** rejects `setState` inside an effect body
  (`react-hooks/set-state-in-effect`). For clock/hydration cases use
  `useSyncExternalStore` with a `getServerSnapshot` — it is the correct fix, not
  a lint suppression.

---

### 7. Credentials before code, always

**Rule:** Confirm `.gitignore` covers `.env*` **before** running anything that
writes an env file. Verify with `git check-ignore -v .env.local` rather than
assuming. Never echo a connection string into terminal output, a file, or a
commit — inspect it by variable name and length instead.

---

### 8. Kill processes by PID, never by a broad image filter

**Anti-pattern:** `taskkill //F //IM node.exe` with loose `WINDOWTITLE` /
`MEMUSAGE` filters, to stop a smoke-test server. On a dev machine that is every
Node process the user has running — another dev server, a watcher, an editor
service. It happened not to match here, and port 3000 (theirs) survived, but
that was luck rather than design.

**Rule:** Resolve the specific listener first and kill that one PID:

```bash
PID=$(netstat -ano | grep ":3100" | grep LISTENING | awk '{print $5}' | head -1)
taskkill //F //PID $PID
```

Then verify the *other* ports you did not intend to touch are still up.

---

### 9. Reset shared fixture data after any smoke test that writes

**Rule:** HTTP smoke tests against the real branch mutate real rows. Reset them
in the same step that created them (statuses to `pending`, `responded_at` to
null, delete created songs/messages) and print the counts as proof. Leaving a
demo invite in a half-answered state makes the next person's test lie to them.

---

### 10. A negated .gitignore rule needs a real test, not `git check-ignore`

**Anti-pattern:** Adding `!.env.example` under `.env*` and then running
`git check-ignore -v .env.example` to confirm it worked. That command prints the
*last matching pattern* and its exit code does not mean what it looks like here,
so it reported "still ignored" for a file that was in fact trackable.

**Rule:** Test tracking status the way git actually decides it:

```bash
git ls-files --others --exclude-standard | grep -x ".env.example"   # should appear
git ls-files --others --exclude-standard | grep -x ".env.local"     # must NOT appear
```

Always assert both directions — that the template is visible *and* that the real
secret file is still hidden.

---

### 11. Adding a `cp .env.example .env.local` step can destroy credentials

**Anti-pattern:** README setup that ran `neon link` (which writes `.env.local`)
and then told the reader to `cp .env.example .env.local`, silently wiping the
database credentials that had just been fetched.

**Rule:** When a tool generates a dotfile, later steps must **append** to it, not
overwrite it. Read setup instructions in order, as a new contributor would, and
ask what each step does to the state left by the previous one.

---

### 12. pnpm 11 fails the whole install on ANY unapproved build script

**Anti-pattern:** Adding only the package that happened to complain locally
(`esbuild`) to `allowBuilds`, and assuming that was the full list. The first
Vercel deploy died on `ERR_PNPM_IGNORED_BUILDS: unrs-resolver@1.12.2` — a native
resolver pulled in by `eslint-config-next`, whose postinstall is skipped on
Windows and therefore never surfaced locally.

**Rule:** `allowBuilds` is not "packages that warned on my machine", it is
"every dependency in the tree with an install script". Enumerate them rather than
waiting to be told, because the set is platform-dependent:

```bash
# list every package in the pnpm store with an install/postinstall script
node -e "…scan node_modules/.pnpm/*/node_modules/*/package.json for scripts.{pre,post,}install…"
```

Then verify with a genuine clean install (`rm -rf node_modules && pnpm install
--frozen-lockfile`), not an incremental one — an already-built store hides the
failure.

---

### 13. Prerendered pages run their data fetches during `next build`

**Rule:** Any page with `revalidate` (ISR) or static rendering executes its
queries on the build machine. Two consequences for this project:

1. Build-time env vars are required. `/court` fails the build without
   `DATABASE_URL`, which is correct — a misconfiguration should be loud.
2. A *transient* failure should not be loud. Neon's free tier suspends after
   inactivity, so a cold compute during a deploy would otherwise fail the whole
   build. `/court` now swallows connection errors only, serving the empty state
   and letting ISR heal it; every other error is rethrown.

The distinction is `isConnectionError` — never a blanket `catch`.

---

### 14. A `loader` function cannot be passed from a Server Component

**Anti-pattern:** `resolveImage()` returned `{ src, loader, unoptimized }` and a
server-rendered page spread that onto `<Image>`. It worked only while `loader`
was `undefined`. The moment Cloudinary was configured and a real function was
returned, the build failed:

```
Error: Functions cannot be passed directly to Client Components
  {src: ..., loader: function i, unoptimized: ...}
```

**Rule:** Nothing crossing the server/client boundary may be a function. For
`next/image`, configure the loader globally instead:

```ts
// next.config.ts
images: { loader: "custom", loaderFile: "./lib/image-loader.ts" }
```

Helpers that build props for client components should return **data only**.
There is now a test asserting `resolveImage` returns no function values, because
this failure only appears once a config value flips.

---

### 15. On a shared third-party account, scope in code — and omit destructive paths

**Context:** The Cloudinary account is shared with other projects.

**Rules applied here, worth repeating for any shared service:**

- The folder prefix is enforced by `scopedPublicId`, which **throws** on any ID
  containing `..`. Public IDs are path-like, so `../other-project/logo` would
  otherwise read — or a future upload path overwrite — someone else's asset.
  A naming convention is something a later edit forgets; a thrown error is not.
- Uploads use `overwrite: false`, so re-running the script is a no-op rather
  than a clobber.
- **There is no delete helper anywhere in the codebase, deliberately.** An
  errant delete on a shared account is unrecoverable, so the safest design is
  one that cannot express it.
