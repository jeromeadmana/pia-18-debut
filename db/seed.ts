import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { courtRoles, guests, invites, seatingTables } from "./schema";
import type { CourtCategory } from "./schema";

// Env comes from `tsx --env-file=.env.local` (see the db:seed script), so
// DATABASE_URL is already populated by the time ./client is evaluated.

/**
 * Idempotent seed.
 *
 * Running this twice must be a no-op, and running it against a half-seeded
 * database must complete the gaps rather than fail. On event day the most likely
 * moment someone runs this is under pressure, so it must never require manual
 * cleanup to recover.
 *
 * Every insert is keyed on a real unique constraint:
 *   seating_tables  -> seating_tables_name_uq
 *   invites         -> invites_rsvp_code_uq        (fixed demo codes, not random)
 *   court_roles     -> court_roles_category_position_uq
 *   guests          -> created only when their invite row was newly inserted
 *
 * Usage:  pnpm db:seed
 */

const FLOOR_PLAN = [
  { name: "Table 1", capacity: 10, locationNote: "Front left, beside the stage" },
  { name: "Table 2", capacity: 10, locationNote: "Front right, beside the stage" },
  { name: "Table 3", capacity: 10, locationNote: "Centre, facing the dance floor" },
  { name: "Table 4", capacity: 8, locationNote: "Centre left" },
  { name: "Table 5", capacity: 8, locationNote: "Centre right" },
  { name: "Table 6", capacity: 10, locationNote: "Rear left, near the bar" },
  { name: "Table 7", capacity: 10, locationNote: "Rear right, near the entrance" },
];

/**
 * Demo invites with FIXED codes. Fixed rather than random precisely so the seed
 * is idempotent and so you can bookmark /i/DEBUT2 while developing.
 *
 * Every code here must be spellable in CODE_ALPHABET (no I, O, 0 or 1) or
 * `isValidRsvpCode` rejects it before it ever reaches the database.
 * Delete these before the real guest list is loaded.
 */
const DEMO_INVITES = [
  {
    rsvpCode: "DEBUT2",
    partyName: "The REPLACE_ME Family",
    maxSeats: 4,
    tableName: "Table 3",
    guests: ["REPLACE_ME Parent One", "REPLACE_ME Parent Two", "REPLACE_ME Child", "Guest"],
  },
  {
    rsvpCode: "DEBUT3",
    partyName: "Tita REPLACE_ME & Guest",
    maxSeats: 2,
    tableName: "Table 5",
    guests: ["Tita REPLACE_ME", "Guest"],
  },
  {
    rsvpCode: "DEBUT4",
    partyName: "REPLACE_ME (18 Roses)",
    maxSeats: 1,
    tableName: "Table 1",
    guests: ["REPLACE_ME Rose 1"],
  },
];

type CourtRow = {
  category: CourtCategory;
  position: number;
  displayName: string;
  dedication: string | null;
};

/**
 * Parse the drop-in roster CSV. Intentionally minimal: the file is authored by
 * hand from a guest list, so we validate loudly rather than guessing.
 */
function readCourtRoster(): CourtRow[] {
  const path = join(process.cwd(), "content", "court.seed.csv");

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    console.warn(`  ! No roster at ${path} — skipping court seed.`);
    return [];
  }

  const valid: CourtCategory[] = [
    "roses",
    "candles",
    "treasures",
    "bills",
    "shots",
    "cotillion",
  ];

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(1); // drop the header row

  return lines.map((line, i) => {
    const [category, position, displayName, dedication = ""] = line.split(",");
    const lineNo = i + 2;

    if (!valid.includes(category as CourtCategory)) {
      throw new Error(`court.seed.csv line ${lineNo}: unknown category "${category}"`);
    }
    const pos = Number(position);
    if (!Number.isInteger(pos) || pos < 1) {
      throw new Error(`court.seed.csv line ${lineNo}: invalid position "${position}"`);
    }
    if (!displayName?.trim()) {
      throw new Error(`court.seed.csv line ${lineNo}: display_name is required`);
    }

    return {
      category: category as CourtCategory,
      position: pos,
      displayName: displayName.trim(),
      dedication: dedication.trim() || null,
    };
  });
}

async function seed() {
  console.log(`Seeding ${process.env.NEON_BRANCH ?? "database"}…\n`);

  /* --- Floor plan ------------------------------------------------------- */
  await db.insert(seatingTables).values(FLOOR_PLAN).onConflictDoNothing();
  const tables = await db.select().from(seatingTables);
  const tableIdByName = new Map(tables.map((t) => [t.name, t.id]));
  console.log(`  seating_tables : ${tables.length} present`);

  /* --- Invites + guests -------------------------------------------------- */
  let newInvites = 0;
  let newGuests = 0;

  for (const demo of DEMO_INVITES) {
    // `returning()` comes back EMPTY when the row already existed, which is
    // exactly the signal we need to avoid re-inserting its guests.
    const [inserted] = await db
      .insert(invites)
      .values({
        rsvpCode: demo.rsvpCode,
        partyName: demo.partyName,
        maxSeats: demo.maxSeats,
        tableId: tableIdByName.get(demo.tableName) ?? null,
      })
      .onConflictDoNothing({ target: invites.rsvpCode })
      .returning({ id: invites.id });

    if (!inserted) continue; // already seeded

    newInvites++;
    await db.insert(guests).values(
      demo.guests.map((fullName, i) => ({
        inviteId: inserted.id,
        fullName,
        isPrimary: i === 0,
      })),
    );
    newGuests += demo.guests.length;
  }

  console.log(`  invites        : ${newInvites} inserted (${DEMO_INVITES.length} total defined)`);
  console.log(`  guests         : ${newGuests} inserted`);

  /* --- 18s court --------------------------------------------------------- */
  const roster = readCourtRoster();
  if (roster.length > 0) {
    await db
      .insert(courtRoles)
      .values(roster)
      .onConflictDoNothing({ target: [courtRoles.category, courtRoles.position] });
  }
  const courtCount = await db.select({ id: courtRoles.id }).from(courtRoles);
  console.log(`  court_roles    : ${courtCount.length} present (${roster.length} in roster)`);

  /* --- Link demo Rose #1 to its guest row --------------------------------- */
  // Demonstrates the guest <-> court link that powers "You are one of the 18 Roses".
  const roseInvite = await db.query.invites.findFirst({
    where: eq(invites.rsvpCode, "DEBUT4"),
    with: { guests: true },
  });
  const roseGuest = roseInvite?.guests[0];
  if (roseGuest) {
    await db
      .update(courtRoles)
      .set({ guestId: roseGuest.id })
      .where(eq(courtRoles.displayName, roseGuest.fullName));
  }

  console.log("\nDone. Demo invite links:");
  for (const d of DEMO_INVITES) console.log(`  /i/${d.rsvpCode}  — ${d.partyName}`);
}

seed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exit(1);
  });
