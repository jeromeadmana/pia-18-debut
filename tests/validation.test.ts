import { describe, expect, it } from "vitest";
import {
  checkSeatLimit,
  guestbookSubmissionSchema,
  rsvpSubmissionSchema,
} from "@/lib/validation";
import { event } from "@/content/event.config";

const validGuest = { guestId: 1, status: "attending" as const, dietaryNotes: null };

describe("rsvpSubmissionSchema", () => {
  it("accepts a well-formed submission and defaults songRequests", () => {
    const parsed = rsvpSubmissionSchema.parse({
      code: "DEBUT2",
      guests: [validGuest],
    });
    expect(parsed.songRequests).toEqual([]);
    expect(parsed.code).toBe("DEBUT2");
  });

  it("uppercases a lowercase code", () => {
    const parsed = rsvpSubmissionSchema.parse({ code: "debut2", guests: [validGuest] });
    expect(parsed.code).toBe("DEBUT2");
  });

  it("rejects a code containing an ambiguous glyph", () => {
    const result = rsvpSubmissionSchema.safeParse({ code: "DEBUT0", guests: [validGuest] });
    expect(result.success).toBe(false);
  });

  it("rejects an empty guest list", () => {
    const result = rsvpSubmissionSchema.safeParse({ code: "DEBUT2", guests: [] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive guest id", () => {
    const result = rsvpSubmissionSchema.safeParse({
      code: "DEBUT2",
      guests: [{ ...validGuest, guestId: 0 }],
    });
    expect(result.success).toBe(false);
  });

  it("normalises blank dietary notes to null", () => {
    const parsed = rsvpSubmissionSchema.parse({
      code: "DEBUT2",
      guests: [{ guestId: 1, status: "attending", dietaryNotes: "   " }],
    });
    expect(parsed.guests[0].dietaryNotes).toBeNull();
  });

  it("caps song requests at three", () => {
    const songs = Array.from({ length: 4 }, (_, i) => ({ title: `Song ${i}` }));
    const result = rsvpSubmissionSchema.safeParse({
      code: "DEBUT2",
      guests: [validGuest],
      songRequests: songs,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a song with an empty title", () => {
    const result = rsvpSubmissionSchema.safeParse({
      code: "DEBUT2",
      guests: [validGuest],
      songRequests: [{ title: "   " }],
    });
    expect(result.success).toBe(false);
  });
});

describe("guestbookSubmissionSchema", () => {
  it("accepts a message without an invite code", () => {
    const parsed = guestbookSubmissionSchema.parse({
      authorName: "Tita Marissa",
      body: "So proud of you.",
    });
    expect(parsed.code).toBeUndefined();
  });

  it("rejects a body longer than the configured maximum", () => {
    const result = guestbookSubmissionSchema.safeParse({
      authorName: "Tita Marissa",
      body: "x".repeat(event.guestbook.maxLength + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only name or body", () => {
    expect(
      guestbookSubmissionSchema.safeParse({ authorName: "  ", body: "Hello" }).success,
    ).toBe(false);
    expect(
      guestbookSubmissionSchema.safeParse({ authorName: "Ana", body: "   " }).success,
    ).toBe(false);
  });
});

describe("checkSeatLimit", () => {
  it("allows a party within its allocation", () => {
    const responses = [
      { guestId: 1, status: "attending" as const, dietaryNotes: null },
      { guestId: 2, status: "attending" as const, dietaryNotes: null },
    ];
    expect(checkSeatLimit(responses, 2).ok).toBe(true);
  });

  it("counts only attending guests, so declines never consume a seat", () => {
    // A party of four with a two-seat allocation is fine if two decline.
    const responses = [
      { guestId: 1, status: "attending" as const, dietaryNotes: null },
      { guestId: 2, status: "attending" as const, dietaryNotes: null },
      { guestId: 3, status: "declined" as const, dietaryNotes: null },
      { guestId: 4, status: "declined" as const, dietaryNotes: null },
    ];
    expect(checkSeatLimit(responses, 2).ok).toBe(true);
  });

  it("rejects an overrun and names the limit in the message", () => {
    const responses = [
      { guestId: 1, status: "attending" as const, dietaryNotes: null },
      { guestId: 2, status: "attending" as const, dietaryNotes: null },
    ];
    const result = checkSeatLimit(responses, 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("1 seat");
      expect(result.message).toContain("2 guests");
    }
  });

  it("treats pending as not consuming a seat", () => {
    const responses = [{ guestId: 1, status: "pending" as const, dietaryNotes: null }];
    expect(checkSeatLimit(responses, 0).ok).toBe(true);
  });
});
