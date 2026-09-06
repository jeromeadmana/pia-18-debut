import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { guests, invites, songRequests } from "@/db/schema";
import { getInviteByCode, submitRsvp } from "@/db/queries";

/**
 * Integration tests against the linked Neon branch.
 *
 * They operate ONLY on the seeded demo invites (DEBUT2/3/4) and restore their
 * state afterwards, so running the suite repeatedly is safe. Requires
 * `pnpm db:seed` to have run.
 *
 * Skips itself when DATABASE_URL is absent so `pnpm test` still passes on a
 * machine with no Neon access.
 */

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const DEMO_CODES = ["DEBUT2", "DEBUT3", "DEBUT4"];

describeDb("invite lookup", () => {
  beforeAll(async () => {
    const invite = await getInviteByCode("DEBUT2");
    if (!invite) {
      throw new Error("Demo data missing. Run `pnpm db:seed` before the integration tests.");
    }
  });

  afterAll(async () => {
    // Restore the demo rows so the suite is re-runnable.
    const rows = await db
      .select({ id: invites.id })
      .from(invites)
      .where(inArray(invites.rsvpCode, DEMO_CODES));
    const ids = rows.map((r) => r.id);

    if (ids.length > 0) {
      await db.delete(songRequests).where(inArray(songRequests.inviteId, ids));
      await db
        .update(guests)
        .set({ rsvpStatus: "pending", dietaryNotes: null })
        .where(inArray(guests.inviteId, ids));
      await db
        .update(invites)
        .set({ respondedAt: null })
        .where(inArray(invites.id, ids));
    }
  });

  it("returns the party, its guests and its table in one call", async () => {
    const invite = await getInviteByCode("DEBUT2");

    expect(invite).not.toBeNull();
    expect(invite!.partyName).toContain("Family");
    expect(invite!.guests.length).toBe(4);
    expect(invite!.table?.name).toBe("Table 3");
  });

  it("lists the primary guest first", async () => {
    const invite = await getInviteByCode("DEBUT2");
    expect(invite!.guests[0].isPrimary).toBe(true);
  });

  it("accepts a lowercase, dash-separated code", async () => {
    const invite = await getInviteByCode(" deb-ut2 ");
    expect(invite).not.toBeNull();
    expect(invite!.rsvpCode).toBe("DEBUT2");
  });

  it("returns null for an unknown code", async () => {
    expect(await getInviteByCode("ZZZZZZ")).toBeNull();
  });

  it("returns null for a malformed code without hitting the database", async () => {
    // Same null as an unknown code — the endpoint must not be a code oracle.
    expect(await getInviteByCode("nope")).toBeNull();
    expect(await getInviteByCode("DEBUT0")).toBeNull();
    expect(await getInviteByCode("")).toBeNull();
  });

  it("surfaces the court role attached to a guest", async () => {
    const invite = await getInviteByCode("DEBUT4");
    const roles = invite!.guests.flatMap((g) => g.courtRoles);

    expect(roles.length).toBeGreaterThan(0);
    expect(roles[0].category).toBe("roses");
  });
});

describeDb("submitRsvp", () => {
  afterAll(async () => {
    const rows = await db
      .select({ id: invites.id })
      .from(invites)
      .where(inArray(invites.rsvpCode, DEMO_CODES));
    const ids = rows.map((r) => r.id);

    if (ids.length > 0) {
      await db.delete(songRequests).where(inArray(songRequests.inviteId, ids));
      await db
        .update(guests)
        .set({ rsvpStatus: "pending", dietaryNotes: null })
        .where(inArray(guests.inviteId, ids));
      await db.update(invites).set({ respondedAt: null }).where(inArray(invites.id, ids));
    }
  });

  it("records a mixed response and stamps respondedAt", async () => {
    const invite = await getInviteByCode("DEBUT2");
    const [a, b, c, d] = invite!.guests;

    const result = await submitRsvp(
      "DEBUT2",
      [
        { guestId: a.id, status: "attending", dietaryNotes: "No shellfish" },
        { guestId: b.id, status: "attending", dietaryNotes: null },
        { guestId: c.id, status: "declined", dietaryNotes: null },
        { guestId: d.id, status: "declined", dietaryNotes: null },
      ],
      [{ title: "Perfect", artist: "Ed Sheeran" }],
    );

    expect(result).toMatchObject({ ok: true, attending: 2, declined: 2 });

    const after = await getInviteByCode("DEBUT2");
    expect(after!.respondedAt).not.toBeNull();
    expect(after!.guests.find((g) => g.id === a.id)?.rsvpStatus).toBe("attending");
    expect(after!.guests.find((g) => g.id === a.id)?.dietaryNotes).toBe("No shellfish");
    expect(after!.guests.find((g) => g.id === c.id)?.rsvpStatus).toBe("declined");
    expect(after!.songRequests).toHaveLength(1);
  });

  it("is idempotent — re-submitting the same songs does not duplicate them", async () => {
    const invite = await getInviteByCode("DEBUT2");
    const responses = invite!.guests.map((g) => ({
      guestId: g.id,
      status: "attending" as const,
      dietaryNotes: null,
    }));

    // maxSeats is 4 and the party is 4, so all-attending is within the limit.
    await submitRsvp("DEBUT2", responses, [{ title: "Perfect", artist: "Ed Sheeran" }]);
    await submitRsvp("DEBUT2", responses, [{ title: "perfect", artist: "Ed Sheeran" }]);

    const after = await getInviteByCode("DEBUT2");
    // The unique index is on lower(title), so the differing case still collides.
    expect(after!.songRequests).toHaveLength(1);
  });

  it("refuses a guest id belonging to a different invite", async () => {
    // The core authorisation test: holding one valid code must not let you
    // rewrite another party's RSVP by guessing a numeric id.
    const mine = await getInviteByCode("DEBUT3");
    const theirs = await getInviteByCode("DEBUT2");
    const victim = theirs!.guests[0];

    const result = await submitRsvp("DEBUT3", [
      { guestId: mine!.guests[0].id, status: "attending", dietaryNotes: null },
      { guestId: victim.id, status: "declined", dietaryNotes: "tampered" },
    ]);

    expect(result).toMatchObject({ ok: false, reason: "unknown_guest" });

    // And nothing landed on the victim.
    const [unchanged] = await db
      .select({ status: guests.rsvpStatus, notes: guests.dietaryNotes })
      .from(guests)
      .where(eq(guests.id, victim.id));
    expect(unchanged.notes).not.toBe("tampered");
  });

  it("rejects more attending guests than the invite has seats", async () => {
    const invite = await getInviteByCode("DEBUT3"); // maxSeats: 2
    const responses = invite!.guests.map((g) => ({
      guestId: g.id,
      status: "attending" as const,
      dietaryNotes: null,
    }));

    // Two guests, two seats — fine.
    expect((await submitRsvp("DEBUT3", responses)).ok).toBe(true);

    // Now shrink the allocation and re-submit the same party.
    await db.update(invites).set({ maxSeats: 1 }).where(eq(invites.id, invite!.id));
    const result = await submitRsvp("DEBUT3", responses);
    await db.update(invites).set({ maxSeats: 2 }).where(eq(invites.id, invite!.id));

    expect(result).toMatchObject({ ok: false, reason: "seat_limit" });
  });

  it("returns not_found for an unknown code rather than throwing", async () => {
    const result = await submitRsvp("ZZZZZZ", [
      { guestId: 1, status: "attending", dietaryNotes: null },
    ]);
    expect(result).toMatchObject({ ok: false, reason: "not_found" });
  });
});
