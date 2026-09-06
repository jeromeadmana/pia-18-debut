import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { guestbookMessages } from "@/db/schema";
import { createGuestbookMessage, listApprovedMessages } from "@/db/queries";

/**
 * The moderation gate is a security property, not a nicety: a public wall on a
 * young woman's birthday site must not publish arbitrary text on submission.
 * These tests pin that behaviour.
 *
 * Every row created here is tracked and deleted afterwards.
 */

const hasDb = Boolean(process.env.DATABASE_URL);
const describeDb = hasDb ? describe : describe.skip;

const created: number[] = [];

describeDb("guestbook moderation", () => {
  afterAll(async () => {
    if (created.length > 0) {
      await db.delete(guestbookMessages).where(inArray(guestbookMessages.id, created));
    }
  });

  it("stores a new message unapproved", async () => {
    const { id } = await createGuestbookMessage({
      authorName: "Test Author",
      body: "A test wish.",
    });
    created.push(id);

    const [row] = await db
      .select({ isApproved: guestbookMessages.isApproved })
      .from(guestbookMessages)
      .where(eq(guestbookMessages.id, id));

    expect(row.isApproved).toBe(false);
  });

  it("keeps an unapproved message off the public wall", async () => {
    const marker = `unapproved-${Date.now()}`;
    const { id } = await createGuestbookMessage({
      authorName: "Test Author",
      body: marker,
    });
    created.push(id);

    const published = await listApprovedMessages(100);
    expect(published.some((m) => m.body === marker)).toBe(false);
  });

  it("publishes a message once it is approved", async () => {
    const marker = `approved-${Date.now()}`;
    const { id } = await createGuestbookMessage({
      authorName: "Test Author",
      body: marker,
    });
    created.push(id);

    await db
      .update(guestbookMessages)
      .set({ isApproved: true })
      .where(eq(guestbookMessages.id, id));

    const published = await listApprovedMessages(100);
    expect(published.some((m) => m.body === marker)).toBe(true);
  });

  it("links a message to an invite when a valid code is supplied", async () => {
    const { id } = await createGuestbookMessage({
      authorName: "Test Author",
      body: "From a known guest.",
      code: "DEBUT2",
    });
    created.push(id);

    const [row] = await db
      .select({ inviteId: guestbookMessages.inviteId })
      .from(guestbookMessages)
      .where(eq(guestbookMessages.id, id));

    expect(row.inviteId).not.toBeNull();
  });

  it("keeps a PRIVATE note off the wall even when approved", async () => {
    // The important one. Privacy and approval are separate axes; a moderator
    // approving by reflex must not publish a note meant for Pia alone.
    const marker = `private-${Date.now()}`;
    const { id } = await createGuestbookMessage({
      authorName: "Test Author",
      body: marker,
      isPrivate: true,
    });
    created.push(id);

    await db
      .update(guestbookMessages)
      .set({ isApproved: true })
      .where(eq(guestbookMessages.id, id));

    const published = await listApprovedMessages(100);
    expect(published.some((m) => m.body === marker)).toBe(false);
  });

  it("defaults isPrivate to false so ordinary wishes still publish", async () => {
    const marker = `public-${Date.now()}`;
    const { id } = await createGuestbookMessage({
      authorName: "Test Author",
      body: marker,
    });
    created.push(id);

    await db
      .update(guestbookMessages)
      .set({ isApproved: true })
      .where(eq(guestbookMessages.id, id));

    const published = await listApprovedMessages(100);
    expect(published.some((m) => m.body === marker)).toBe(true);
  });

  it("still accepts a message when the code is unknown, but links nothing", async () => {
    // A wrong code must not cost someone their message.
    const { id } = await createGuestbookMessage({
      authorName: "Test Author",
      body: "From an unknown code.",
      code: "ZZZZZZ",
    });
    created.push(id);

    const [row] = await db
      .select({ inviteId: guestbookMessages.inviteId })
      .from(guestbookMessages)
      .where(eq(guestbookMessages.id, id));

    expect(row.inviteId).toBeNull();
  });
});
