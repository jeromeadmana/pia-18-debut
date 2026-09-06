import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Schema notes
 *
 * The central modelling decision: an INVITE IS A PARTY, NOT A PERSON.
 * "The Reyes Family +3" is one `rsvp_code` and one row in `invites`, with four
 * rows in `guests` hanging off it. This is what makes multi-guest RSVP, per-guest
 * dietary notes, and a single shareable link all work at once.
 *
 * Column names are written out explicitly rather than relying on the `casing`
 * setting, so the SQL is unambiguous no matter how the client is constructed.
 */

export const rsvpStatusEnum = pgEnum("rsvp_status", [
  "pending",
  "attending",
  "declined",
]);

export const courtCategoryEnum = pgEnum("court_category", [
  "roses",
  "candles",
  "treasures",
  "bills",
  "shots",
  "cotillion",
]);

/** Seating tables in the hall. Named `seating_tables` to avoid a generic `tables`. */
export const seatingTables = pgTable(
  "seating_tables",
  {
    id: serial("id").primaryKey(),
    /** Display label: "Table 7" or "Sampaguita". */
    name: text("name").notNull(),
    capacity: integer("capacity").notNull().default(10),
    /** Free-text wayfinding: "Near the stage, left of the dance floor". */
    locationNote: text("location_note"),
  },
  (t) => [
    // Two tables with the same name is always a data-entry bug, and this is what
    // lets the seed script re-run without duplicating the floor plan.
    uniqueIndex("seating_tables_name_uq").on(t.name),
  ],
);

export const invites = pgTable(
  "invites",
  {
    id: serial("id").primaryKey(),
    /**
     * The secret in the invite link (/i/A7K2M9). This is the ONLY way a guest
     * reaches their details, so it is the hottest read path on the site.
     */
    rsvpCode: text("rsvp_code").notNull(),
    /** "The Reyes Family", "Tita Marissa & Guest". */
    partyName: text("party_name").notNull(),
    /** Seats allotted. Server rejects RSVPs claiming more attendees than this. */
    maxSeats: integer("max_seats").notNull().default(1),
    tableId: integer("table_id").references(() => seatingTables.id, {
      onDelete: "set null",
    }),
    /** Null until the party responds; stamped on first submission. */
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Every invite page load is one index hit on this. Keeps us far inside
    // Vercel's 10s ceiling even after a Neon cold start.
    uniqueIndex("invites_rsvp_code_uq").on(t.rsvpCode),
  ],
);

export const guests = pgTable(
  "guests",
  {
    id: serial("id").primaryKey(),
    inviteId: integer("invite_id")
      .notNull()
      .references(() => invites.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    rsvpStatus: rsvpStatusEnum("rsvp_status").notNull().default("pending"),
    dietaryNotes: text("dietary_notes"),
    /** The named invitee, as opposed to their plus-ones. */
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("guests_invite_id_idx").on(t.inviteId),
    // Expression index for case-insensitive ADMIN search. Guests never search by
    // name publicly — that would make the whole guest list enumerable.
    index("guests_full_name_lower_idx").on(sql`lower(${t.fullName})`),
  ],
);

export const courtRoles = pgTable(
  "court_roles",
  {
    id: serial("id").primaryKey(),
    /**
     * Nullable on purpose. The public court list renders from `displayName`
     * alone and never joins to `guests`, so no guest PII can leak through it.
     * When set, it powers "You are one of the 18 Roses" on that guest's own page.
     */
    guestId: integer("guest_id").references(() => guests.id, {
      onDelete: "set null",
    }),
    category: courtCategoryEnum("category").notNull(),
    /** 1..18 within the category. */
    position: integer("position").notNull(),
    displayName: text("display_name").notNull(),
    /** Their line for the ceremony, if they have submitted one. */
    dedication: text("dedication"),
  },
  (t) => [
    // There can only be one 7th Rose.
    uniqueIndex("court_roles_category_position_uq").on(t.category, t.position),
    index("court_roles_guest_id_idx").on(t.guestId),
  ],
);

export const guestbookMessages = pgTable(
  "guestbook_messages",
  {
    id: serial("id").primaryKey(),
    inviteId: integer("invite_id").references(() => invites.id, {
      onDelete: "set null",
    }),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    /**
     * Defaults to false. A public wall on a young woman's birthday site is a
     * defacement vector; nothing renders until it is reviewed.
     */
    isApproved: boolean("is_approved").notNull().default(false),
    /**
     * A note meant for Pia alone, left during RSVP. Private messages are
     * excluded from the public wall *regardless of approval* — approval and
     * privacy are separate axes, and conflating them is how a private note ends
     * up published by a distracted moderator.
     */
    isPrivate: boolean("is_private").notNull().default(false),
    /**
     * Cloudinary public ID of a recorded voice wish, WITHOUT the folder prefix
     * (see lib/cloudinary.ts). Null for an ordinary written wish.
     *
     * The audio itself never touches Postgres — a blob column would bloat every
     * row read on the hot path and blow past Neon's free-tier storage. This is a
     * pointer; the bytes live in Cloudinary under pia-18-debut/wishes/.
     */
    audioPublicId: text("audio_public_id"),
    /** Seconds, as reported by the recorder. Display only — never trusted. */
    audioDurationSec: integer("audio_duration_sec"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Serves the only public query: approved, non-private, newest first.
    index("guestbook_public_idx").on(t.isApproved, t.isPrivate, t.createdAt.desc()),
  ],
);

export const songRequests = pgTable(
  "song_requests",
  {
    id: serial("id").primaryKey(),
    inviteId: integer("invite_id")
      .notNull()
      .references(() => invites.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    artist: text("artist"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("song_requests_invite_id_idx").on(t.inviteId),
    // Makes re-submitting an RSVP idempotent: the same song from the same party
    // collides here and is dropped with onConflictDoNothing, rather than piling up.
    uniqueIndex("song_requests_invite_title_uq").on(
      t.inviteId,
      sql`lower(${t.title})`,
    ),
  ],
);

/* -------------------------------------------------------------------------- */
/* Relations — enable the `db.query.*` relational API                          */
/* -------------------------------------------------------------------------- */

export const invitesRelations = relations(invites, ({ one, many }) => ({
  table: one(seatingTables, {
    fields: [invites.tableId],
    references: [seatingTables.id],
  }),
  guests: many(guests),
  songRequests: many(songRequests),
}));

export const guestsRelations = relations(guests, ({ one, many }) => ({
  invite: one(invites, {
    fields: [guests.inviteId],
    references: [invites.id],
  }),
  courtRoles: many(courtRoles),
}));

export const seatingTablesRelations = relations(seatingTables, ({ many }) => ({
  invites: many(invites),
}));

export const courtRolesRelations = relations(courtRoles, ({ one }) => ({
  guest: one(guests, {
    fields: [courtRoles.guestId],
    references: [guests.id],
  }),
}));

export const songRequestsRelations = relations(songRequests, ({ one }) => ({
  invite: one(invites, {
    fields: [songRequests.inviteId],
    references: [invites.id],
  }),
}));

export const guestbookMessagesRelations = relations(
  guestbookMessages,
  ({ one }) => ({
    invite: one(invites, {
      fields: [guestbookMessages.inviteId],
      references: [invites.id],
    }),
  }),
);

/* -------------------------------------------------------------------------- */
/* Inferred types                                                              */
/* -------------------------------------------------------------------------- */

export type SeatingTable = typeof seatingTables.$inferSelect;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
export type CourtRole = typeof courtRoles.$inferSelect;
export type NewCourtRole = typeof courtRoles.$inferInsert;
export type GuestbookMessage = typeof guestbookMessages.$inferSelect;
export type SongRequest = typeof songRequests.$inferSelect;
export type RsvpStatus = (typeof rsvpStatusEnum.enumValues)[number];
export type CourtCategory = (typeof courtCategoryEnum.enumValues)[number];
