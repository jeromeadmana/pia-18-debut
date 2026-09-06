import { beforeAll, describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  createSessionToken,
  verifyAdminPassword,
  verifySessionToken,
} from "@/lib/auth";

/**
 * The admin gate protects the entire guest list. These tests pin the properties
 * that make it a gate rather than a suggestion.
 */

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET ??= "x".repeat(64);
  process.env.ADMIN_PASSWORD ??= "correct-horse-battery-staple";
});

describe("session tokens", () => {
  it("round-trips a freshly minted token", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it("rejects a token whose signature was altered", async () => {
    const token = await createSessionToken();
    const [payload, signature] = token.split(".");

    // Flip one character of the signature.
    const tampered = `${payload}.${signature.slice(0, -1)}${
      signature.at(-1) === "A" ? "B" : "A"
    }`;

    expect(await verifySessionToken(tampered)).toBe(false);
  });

  it("rejects a token whose expiry was extended", async () => {
    // The whole point of signing: you cannot grant yourself more time.
    const token = await createSessionToken();
    const signature = token.slice(token.lastIndexOf(".") + 1);
    const forged = `${Date.now() + 10 * SESSION_TTL_MS}.${signature}`;

    expect(await verifySessionToken(forged)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const issuedAt = Date.now() - SESSION_TTL_MS - 1000;
    const token = await createSessionToken(issuedAt);

    expect(await verifySessionToken(token)).toBe(false);
  });

  it("accepts a token right up to its expiry", async () => {
    const now = Date.now();
    const token = await createSessionToken(now);

    expect(await verifySessionToken(token, now + SESSION_TTL_MS - 1000)).toBe(true);
  });

  it("rejects malformed input rather than throwing", async () => {
    for (const bad of ["", "nonsense", ".", "abc.", ".abc", "a.b.c"]) {
      expect(await verifySessionToken(bad)).toBe(false);
    }
    expect(await verifySessionToken(undefined)).toBe(false);
  });

  it("does not accept a token signed with a different secret", async () => {
    const original = process.env.ADMIN_SESSION_SECRET;
    const token = await createSessionToken();

    process.env.ADMIN_SESSION_SECRET = "y".repeat(64);
    const acceptedUnderNewSecret = await verifySessionToken(token);
    process.env.ADMIN_SESSION_SECRET = original;

    expect(acceptedUnderNewSecret).toBe(false);
  });
});

describe("verifyAdminPassword", () => {
  it("accepts the configured password", async () => {
    expect(await verifyAdminPassword(process.env.ADMIN_PASSWORD!)).toBe(true);
  });

  it("rejects a wrong password, including near misses", async () => {
    expect(await verifyAdminPassword("wrong")).toBe(false);
    expect(await verifyAdminPassword("correct-horse-battery-stapl")).toBe(false);
    expect(await verifyAdminPassword("")).toBe(false);
  });

  it("fails closed when no password is configured", async () => {
    // An unset ADMIN_PASSWORD must lock everyone out, never let everyone in.
    const original = process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD;

    const acceptedEmpty = await verifyAdminPassword("");
    const acceptedAnything = await verifyAdminPassword("anything");

    process.env.ADMIN_PASSWORD = original;

    expect(acceptedEmpty).toBe(false);
    expect(acceptedAnything).toBe(false);
  });
});
