import { defineConfig } from "@neon/config/v1";

/**
 * Neon INFRASTRUCTURE policy — which Neon services exist and how branches behave.
 *
 * This file does NOT manage database tables. Schema and migrations are owned by
 * Drizzle (`db/schema.ts` + `db/migrations/`, applied with `pnpm db:migrate`).
 *
 * Currently empty, which is intentional: we use only plain Postgres, with no
 * Neon Auth / Data API / Functions / Storage. `neon deploy` on this config is a
 * deliberate no-op. Credentials already reached `.env.local` via `neon link`.
 */
export default defineConfig({});
