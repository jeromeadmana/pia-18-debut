import { z } from "zod";
import { event } from "@/content/event.config";
import { CODE_ALPHABET, CODE_LENGTH } from "./codes";

/**
 * Validation schemas shared by client and server.
 *
 * The client uses these for instant feedback; the API routes re-parse the same
 * schemas because client-side validation is a convenience, never a control.
 */

export const rsvpCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`),
    "That code doesn't look right — it should be 6 characters.",
  );

export const rsvpStatusSchema = z.enum(["pending", "attending", "declined"]);

/** One person's answer within a party's response. */
export const guestResponseSchema = z.object({
  guestId: z.number().int().positive(),
  status: rsvpStatusSchema,
  dietaryNotes: z
    .string()
    .trim()
    .max(280, "Please keep dietary notes under 280 characters.")
    .nullish()
    .transform((v) => (v ? v : null)),
});

export const songRequestSchema = z.object({
  title: z.string().trim().min(1, "Song title is required.").max(120),
  artist: z
    .string()
    .trim()
    .max(120)
    .nullish()
    .transform((v) => (v ? v : null)),
});

export const rsvpSubmissionSchema = z.object({
  code: rsvpCodeSchema,
  guests: z
    .array(guestResponseSchema)
    .min(1, "At least one guest must respond.")
    // Generous ceiling; the real per-invite limit is checked server-side against
    // `invites.max_seats`, which this schema cannot know about.
    .max(20, "Too many guests in one response."),
  songRequests: z.array(songRequestSchema).max(3, "Up to three songs, please.").default([]),
});

const guestbookFields = z.object({
  authorName: z
    .string()
    .trim()
    .min(1, "Please tell Pia who this is from.")
    .max(80, "Please keep the name under 80 characters."),
  /**
   * Optional now that a wish can be audio instead. The `refine` below enforces
   * that a submission carries *something*.
   */
  body: z
    .string()
    .trim()
    .max(
      event.guestbook.maxLength,
      `Please keep your message under ${event.guestbook.maxLength} characters.`,
    )
    .default(""),
  /**
   * Cloudinary public ID of a recorded wish, without the folder prefix.
   *
   * The pattern is deliberately strict: these ids are generated server-side in
   * `createUploadTicket`, so anything not matching that shape is a caller
   * inventing a path — which on a shared Cloudinary account is how you end up
   * pointing at somebody else's asset.
   */
  audioPublicId: z
    .string()
    .trim()
    .regex(/^wish-[0-9a-f]{16}$/, "That recording reference isn't valid.")
    .nullish()
    .transform((v) => v ?? null),
  /** Display only; never trusted for billing or limits. */
  audioDurationSec: z
    .number()
    .int()
    .min(0)
    .max(120)
    .nullish()
    .transform((v) => v ?? null),
  /** Present when posting from an invite page; absent for an open message. */
  code: rsvpCodeSchema.optional(),
  /**
   * A note for Pia alone, left during RSVP. Excluded from the public wall
   * regardless of moderation.
   */
  isPrivate: z.boolean().default(false),
});

/** A wish must carry something — written, spoken, or both. */
export const guestbookSubmissionSchema = guestbookFields.refine(
  (v) => v.body.trim().length > 0 || v.audioPublicId !== null,
  { message: "Please write a message or record a voice wish.", path: ["body"] },
);

export type RsvpSubmission = z.infer<typeof rsvpSubmissionSchema>;
export type GuestResponse = z.infer<typeof guestResponseSchema>;
export type GuestbookSubmission = z.infer<typeof guestbookSubmissionSchema>;

/**
 * Seat-limit check. Kept separate from the Zod schema because it needs the
 * invite's `maxSeats`, which only the server knows after loading the row.
 *
 * Note it counts ATTENDING guests only — a party of 4 with 2 attending and
 * 2 declining is fine against a 2-seat allocation.
 */
export function checkSeatLimit(
  responses: readonly GuestResponse[],
  maxSeats: number,
): { ok: true } | { ok: false; message: string } {
  const attending = responses.filter((r) => r.status === "attending").length;

  if (attending > maxSeats) {
    return {
      ok: false,
      message:
        `This invitation is for ${maxSeats} ${maxSeats === 1 ? "seat" : "seats"}, ` +
        `but ${attending} guests are marked attending. ` +
        `Please contact ${event.rsvp.contactName} to request more.`,
    };
  }
  return { ok: true };
}
