import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { invites } from "../db/schema";

/**
 * Measure the real cost of the hottest read path: one indexed invite lookup
 * with its guests, table and court roles.
 *
 * Why this exists: Vercel Hobby kills a function at 10s, and Neon's free tier
 * suspends the compute after inactivity, so the first request after a quiet
 * spell pays a resume penalty. This script tells you what that actually costs
 * instead of guessing.
 *
 * To measure a genuine COLD start, leave the branch idle (~5 minutes on the free
 * tier) and run this as the first thing that touches it. Running it twice in a
 * row measures a warm compute — useful, but a different number.
 *
 * Usage:  pnpm db:latency
 */

const CODE = process.argv[2] ?? "DEBUT2";
const RUNS = 5;

async function lookup() {
  return db.query.invites.findFirst({
    where: eq(invites.rsvpCode, CODE),
    with: { table: true, guests: { with: { courtRoles: true } }, songRequests: true },
  });
}

async function main() {
  console.log(`Timing invite lookup for "${CODE}" against ${process.env.NEON_BRANCH ?? "?"}\n`);

  const timings: number[] = [];

  for (let i = 0; i < RUNS; i++) {
    const started = performance.now();
    const invite = await lookup();
    const elapsed = performance.now() - started;
    timings.push(elapsed);

    const label = i === 0 ? "first (cold if idle)" : `warm #${i}`;
    console.log(
      `  ${label.padEnd(22)} ${elapsed.toFixed(0).padStart(6)} ms` +
        (invite ? "" : "   (no such invite)"),
    );
  }

  const warm = timings.slice(1);
  const mean = warm.reduce((a, b) => a + b, 0) / warm.length;

  console.log(`\n  first        : ${timings[0].toFixed(0)} ms`);
  console.log(`  warm mean    : ${mean.toFixed(0)} ms`);
  console.log(`  budget       : 10000 ms (Vercel Hobby function ceiling)`);
  console.log(
    `  headroom     : ${(10_000 - timings[0]).toFixed(0)} ms on the first request`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Latency check failed:", error);
    process.exit(1);
  });
