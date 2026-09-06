import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Drizzle over the Neon HTTP driver.
 *
 * Why neon-http and not a Pool: every query is a stateless `fetch`. There is no
 * connection pool to exhaust against Neon's free-tier cap, and nothing to keep
 * warm between Vercel invocations.
 *
 * The tradeoff, and it is a real one: **neon-http has no interactive
 * transactions.** `db.transaction(async (tx) => ...)` is not available. Any
 * multi-statement write must go through `db.batch([...])`, which the driver
 * sends as a single atomic round trip. See `submitRsvp` in `db/queries.ts`.
 */

function connectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Locally, run `neon link` to write .env.local. " +
        "On Vercel, add it under Project Settings > Environment Variables.",
    );
  }
  return url;
}

export const db = drizzle(neon(connectionString()), {
  schema,
  casing: "snake_case",
});

export type Database = typeof db;

/**
 * Retry a READ once after a connection-level failure.
 *
 * Neon's free tier auto-suspends after inactivity, so the first request after a
 * quiet spell can fail or stall while the compute resumes (~1-2s). One retry
 * turns that into a slightly slow page instead of an error.
 *
 * Deliberately narrow:
 *   - Only connection/transport failures are retried. A genuine query error
 *     (constraint violation, syntax) is rethrown immediately — retrying it would
 *     just burn seconds against the 10s function ceiling.
 *   - **Never wrap a write in this.** A write that timed out may well have
 *     landed; replaying it risks duplicate rows. Writes get their idempotency
 *     from unique constraints instead (see `song_requests_invite_title_uq`).
 */
export async function withRetry<T>(
  read: () => Promise<T>,
  { retries = 1, backoffMs = 250 }: { retries?: number; backoffMs?: number } = {},
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (!isConnectionError(error) || attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  throw lastError;
}

/**
 * Distinguish "the database was asleep / unreachable" from "the query was wrong".
 * Matches on transport-level signals only.
 */
export function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  // `fetch` transport failures surface as TypeError with a terse message.
  const message = `${error.message} ${(error.cause as Error | undefined)?.message ?? ""}`;

  return /fetch failed|network|socket|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|terminated|timeout|Connection|502|503|504/i.test(
    message,
  );
}
