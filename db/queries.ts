import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { db, isConnectionError, withRetry } from "./client";
import {
  courtRoles,
  guestbookMessages,
  guests,
  invites,
  seatingTables,
  songRequests,
} from "./schema";
import type { CourtCategory } from "./schema";
import { normalizeRsvpCode, isValidRsvpCode } from "@/lib/codes";
import { checkSeatLimit, type GuestResponse } from "@/lib/validation";

/**
 * All database access lives here. Route handlers and pages call these functions
 * and never build queries inline, so the index-usage and scoping rules below
 * hold everywhere by construction.
 */

export type InviteDetail = NonNullable<Awaited<ReturnType<typeof getInviteByCode>>>;

/**
 * Load everything an invite page needs in ONE round trip.
 *
 * Drizzle's relational API compiles this to a single query with lateral joins,
 * which matters: on a cold Neon compute, one round trip costs ~1-2s and four
 * would flirt with Vercel's 10s ceiling.
 *
 * Returns null for both "malformed code" and "no such code" — the caller must
 * not be able to tell those apart, or the endpoint becomes a code oracle.
 */
export async function getInviteByCode(rawCode: string) {
  const code = normalizeRsvpCode(rawCode);

  // Cheap reject before spending a database round trip on an impossible code.
  if (!isValidRsvpCode(code)) return null;

  const invite = await withRetry(() =>
    db.query.invites.findFirst({
      where: eq(invites.rsvpCode, code),
      with: {
        table: true,
        guests: {
          orderBy: [desc(guests.isPrimary), asc(guests.id)],
          with: {
            courtRoles: {
              columns: { category: true, position: true, displayName: true },
            },
          },
        },
        songRequests: {
          columns: { id: true, title: true, artist: true },
          orderBy: [asc(songRequests.id)],
        },
      },
    }),
  );

  return invite ?? null;
}

export type RsvpResult =
  | { ok: true; attending: number; declined: number }
  | { ok: false; reason: "not_found" | "seat_limit" | "unknown_guest"; message: string };

/**
 * Record a party's RSVP.
 *
 * Two things worth knowing:
 *
 * 1. **No interactive transaction.** neon-http cannot do `db.transaction()`, so
 *    every statement goes into a single `db.batch([...])`, which the driver
 *    sends as one atomic unit — all of it lands or none of it does.
 *
 * 2. **Guest IDs are scoped to the invite, twice.** We reject IDs that do not
 *    belong to this invite up front, AND every UPDATE carries
 *    `invite_id = <this invite>` in its WHERE. Without that second guard, anyone
 *    holding one valid code could rewrite any other guest's RSVP by passing a
 *    guessed numeric id.
 */
export async function submitRsvp(
  rawCode: string,
  responses: readonly GuestResponse[],
  songs: readonly { title: string; artist: string | null }[] = [],
): Promise<RsvpResult> {
  const invite = await getInviteByCode(rawCode);

  if (!invite) {
    return { ok: false, reason: "not_found", message: "We couldn't find that invitation." };
  }

  // Guard 1: every submitted id must belong to this invite.
  const ownedIds = new Set(invite.guests.map((g) => g.id));
  const foreign = responses.filter((r) => !ownedIds.has(r.guestId));
  if (foreign.length > 0) {
    return {
      ok: false,
      reason: "unknown_guest",
      message: "That response included a guest who isn't on this invitation.",
    };
  }

  const seats = checkSeatLimit(responses, invite.maxSeats);
  if (!seats.ok) {
    return { ok: false, reason: "seat_limit", message: seats.message };
  }

  const statements = [
    ...responses.map((r) =>
      db
        .update(guests)
        .set({ rsvpStatus: r.status, dietaryNotes: r.dietaryNotes })
        // Guard 2: scope the write to this invite regardless of the id passed.
        .where(and(eq(guests.id, r.guestId), eq(guests.inviteId, invite.id))),
    ),
    db
      .update(invites)
      .set({ respondedAt: new Date() })
      .where(eq(invites.id, invite.id)),
    ...songs.map((song) =>
      db
        .insert(songRequests)
        .values({ inviteId: invite.id, title: song.title, artist: song.artist })
        // Re-submitting the same RSVP must not pile up duplicate songs. The
        // unique index on (invite_id, lower(title)) makes this a no-op.
        .onConflictDoNothing(),
    ),
  ];

  // `batch` wants a non-empty tuple; `statements` always has at least the
  // invites UPDATE, so the assertion is safe.
  await db.batch(statements as unknown as [BatchItem<"pg">, ...BatchItem<"pg">[]]);

  return {
    ok: true,
    attending: responses.filter((r) => r.status === "attending").length,
    declined: responses.filter((r) => r.status === "declined").length,
  };
}

/**
 * The public 18s court, grouped by category.
 *
 * Selects `displayName` only and never joins `guests`, so this endpoint cannot
 * leak guest PII even though it is rendered on a fully public, cached page.
 */
export async function listCourt(): Promise<Record<CourtCategory, CourtEntry[]>> {
  const rows = await withRetry(() =>
    db
      .select({
        category: courtRoles.category,
        position: courtRoles.position,
        displayName: courtRoles.displayName,
        dedication: courtRoles.dedication,
      })
      .from(courtRoles)
      .orderBy(asc(courtRoles.category), asc(courtRoles.position)),
  );

  const grouped = {} as Record<CourtCategory, CourtEntry[]>;
  for (const row of rows) {
    (grouped[row.category] ??= []).push({
      position: row.position,
      displayName: row.displayName,
      dedication: row.dedication,
    });
  }
  return grouped;
}

/**
 * `listCourt`, but a sleeping database degrades to an empty court instead of
 * failing the render.
 *
 * Both `/` and `/court` are prerendered, so they run this on the build machine.
 * Neon's free tier suspends after inactivity and a cold compute during a deploy
 * should not fail the build. ISR replaces the empty state within the revalidate
 * window.
 *
 * Only CONNECTION failures are swallowed. A missing DATABASE_URL, a bad query or
 * schema drift is rethrown, because a misconfiguration should be loud.
 */
export async function listCourtTolerant(): Promise<Record<CourtCategory, CourtEntry[]>> {
  try {
    return await listCourt();
  } catch (error) {
    if (!isConnectionError(error)) throw error;

    console.error(
      "[court] database unreachable during render — serving the empty state; " +
        "ISR will retry within the revalidate window.",
      error,
    );
    return {} as Record<CourtCategory, CourtEntry[]>;
  }
}

export type CourtEntry = {
  position: number;
  displayName: string;
  dedication: string | null;
};

/** Approved guestbook messages, newest first. Served by the composite index. */
export async function listApprovedMessages(limit = 50) {
  return withRetry(() =>
    db
      .select({
        id: guestbookMessages.id,
        authorName: guestbookMessages.authorName,
        body: guestbookMessages.body,
        createdAt: guestbookMessages.createdAt,
      })
      .from(guestbookMessages)
      .where(eq(guestbookMessages.isApproved, true))
      .orderBy(desc(guestbookMessages.createdAt))
      .limit(limit),
  );
}

/**
 * Post a wish. Always lands unapproved — nothing reaches the public wall until
 * a human reviews it.
 */
export async function createGuestbookMessage(input: {
  authorName: string;
  body: string;
  code?: string;
}): Promise<{ id: number }> {
  let inviteId: number | null = null;

  if (input.code) {
    const invite = await getInviteByCode(input.code);
    inviteId = invite?.id ?? null;
  }

  const [row] = await db
    .insert(guestbookMessages)
    .values({
      authorName: input.authorName,
      body: input.body,
      inviteId,
      isApproved: false,
    })
    .returning({ id: guestbookMessages.id });

  return row;
}

/**
 * ADMIN ONLY — case-insensitive guest search.
 *
 * Hits the `guests_full_name_lower_idx` expression index. This must never be
 * exposed on a public route; it would make the entire guest list enumerable,
 * which is precisely what the invite-code design exists to prevent.
 */
export async function searchGuestsByName(query: string, limit = 20) {
  const term = query.trim().toLowerCase();
  if (!term) return [];

  return withRetry(() =>
    db
      .select({
        guestId: guests.id,
        fullName: guests.fullName,
        rsvpStatus: guests.rsvpStatus,
        partyName: invites.partyName,
        rsvpCode: invites.rsvpCode,
        tableId: invites.tableId,
      })
      .from(guests)
      .innerJoin(invites, eq(guests.inviteId, invites.id))
      .where(sql`lower(${guests.fullName}) LIKE ${`%${term}%`}`)
      .orderBy(asc(guests.fullName))
      .limit(limit),
  );
}

/* -------------------------------------------------------------------------- */
/* ADMIN                                                                       */
/*                                                                             */
/* Everything below exposes guest PII and must only ever be reached through a   */
/* route under /admin or /api/admin. Those are pre-filtered by `proxy.ts` and    */
/* re-verified per route via lib/admin-session. None of it may be imported into  */
/* a public page.                                                               */
/* -------------------------------------------------------------------------- */

/** Headline RSVP numbers. One grouped scan, not five count queries. */
export async function getRsvpSummary() {
  const [statusRows, inviteRow, messageRow] = await Promise.all([
    withRetry(() =>
      db
        .select({ status: guests.rsvpStatus, count: sql<number>`count(*)::int` })
        .from(guests)
        .groupBy(guests.rsvpStatus),
    ),
    withRetry(() =>
      db
        .select({
          total: sql<number>`count(*)::int`,
          responded: sql<number>`count(${invites.respondedAt})::int`,
          seats: sql<number>`coalesce(sum(${invites.maxSeats}), 0)::int`,
        })
        .from(invites),
    ),
    withRetry(() =>
      db
        .select({
          pending: sql<number>`count(*) filter (where ${guestbookMessages.isApproved} = false)::int`,
          approved: sql<number>`count(*) filter (where ${guestbookMessages.isApproved} = true)::int`,
        })
        .from(guestbookMessages),
    ),
  ]);

  const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.count]));

  return {
    attending: byStatus.attending ?? 0,
    declined: byStatus.declined ?? 0,
    pending: byStatus.pending ?? 0,
    invitesTotal: inviteRow[0]?.total ?? 0,
    invitesResponded: inviteRow[0]?.responded ?? 0,
    seatsAllocated: inviteRow[0]?.seats ?? 0,
    messagesPending: messageRow[0]?.pending ?? 0,
    messagesApproved: messageRow[0]?.approved ?? 0,
  };
}

/** The moderation queue: unapproved first, oldest first so nothing rots. */
export async function listMessagesForReview(limit = 100) {
  return withRetry(() =>
    db
      .select({
        id: guestbookMessages.id,
        authorName: guestbookMessages.authorName,
        body: guestbookMessages.body,
        isApproved: guestbookMessages.isApproved,
        createdAt: guestbookMessages.createdAt,
      })
      .from(guestbookMessages)
      .orderBy(asc(guestbookMessages.isApproved), asc(guestbookMessages.createdAt))
      .limit(limit),
  );
}

export async function setMessageApproval(id: number, isApproved: boolean) {
  const [row] = await db
    .update(guestbookMessages)
    .set({ isApproved })
    .where(eq(guestbookMessages.id, id))
    .returning({ id: guestbookMessages.id, isApproved: guestbookMessages.isApproved });

  return row ?? null;
}

export async function deleteMessage(id: number) {
  const [row] = await db
    .delete(guestbookMessages)
    .where(eq(guestbookMessages.id, id))
    .returning({ id: guestbookMessages.id });

  return row ?? null;
}

/** Every invite with its response tally, for the seating view. */
export async function listInvitesForAdmin() {
  return withRetry(() =>
    db
      .select({
        id: invites.id,
        rsvpCode: invites.rsvpCode,
        partyName: invites.partyName,
        maxSeats: invites.maxSeats,
        tableId: invites.tableId,
        tableName: seatingTables.name,
        respondedAt: invites.respondedAt,
        attending: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'attending')::int`,
        declined: sql<number>`count(*) filter (where ${guests.rsvpStatus} = 'declined')::int`,
        partySize: sql<number>`count(${guests.id})::int`,
      })
      .from(invites)
      .leftJoin(guests, eq(guests.inviteId, invites.id))
      .leftJoin(seatingTables, eq(invites.tableId, seatingTables.id))
      .groupBy(invites.id, seatingTables.name)
      .orderBy(asc(invites.partyName)),
  );
}

export async function listSeatingTables() {
  return withRetry(() =>
    db
      .select({
        id: seatingTables.id,
        name: seatingTables.name,
        capacity: seatingTables.capacity,
        locationNote: seatingTables.locationNote,
        seated: sql<number>`(
          select coalesce(sum(i.max_seats), 0)::int
          from invites i where i.table_id = ${seatingTables.id}
        )`,
      })
      .from(seatingTables)
      .orderBy(asc(seatingTables.id)),
  );
}

/** Move a party to a table, or clear the assignment with null. */
export async function assignTable(inviteId: number, tableId: number | null) {
  const [row] = await db
    .update(invites)
    .set({ tableId })
    .where(eq(invites.id, inviteId))
    .returning({ id: invites.id, tableId: invites.tableId });

  return row ?? null;
}
