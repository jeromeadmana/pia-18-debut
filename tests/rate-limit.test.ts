import { beforeEach, describe, expect, it } from "vitest";
import { __resetRateLimits, clientKey, rateLimit } from "@/lib/rate-limit";

beforeEach(() => __resetRateLimits());

const opts = { limit: 3, windowMs: 60_000 };

describe("rateLimit", () => {
  it("allows requests up to the limit", () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("k", opts, now).ok).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) rateLimit("k", opts, now);

    const blocked = rateLimit("k", opts, now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("reports remaining budget accurately", () => {
    const now = Date.now();
    expect(rateLimit("k", opts, now).remaining).toBe(2);
    expect(rateLimit("k", opts, now).remaining).toBe(1);
    expect(rateLimit("k", opts, now).remaining).toBe(0);
  });

  it("keeps separate keys independent", () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) rateLimit("a", opts, now);

    expect(rateLimit("a", opts, now).ok).toBe(false);
    expect(rateLimit("b", opts, now).ok).toBe(true);
  });

  it("resets once the window has elapsed", () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) rateLimit("k", opts, now);
    expect(rateLimit("k", opts, now).ok).toBe(false);

    expect(rateLimit("k", opts, now + 60_001).ok).toBe(true);
  });
});

describe("clientKey", () => {
  const make = (headers: Record<string, string>) =>
    new Request("https://example.com/", { headers });

  it("uses the leftmost x-forwarded-for entry", () => {
    const key = clientKey(make({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }), "rsvp");
    expect(key).toBe("rsvp:1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKey(make({ "x-real-ip": "9.9.9.9" }), "rsvp")).toBe("rsvp:9.9.9.9");
  });

  it("collapses to a shared bucket when no header is present", () => {
    // Failing toward over-limiting is the safe direction.
    expect(clientKey(make({}), "rsvp")).toBe("rsvp:unknown");
  });

  it("scopes keys so endpoints do not share a budget", () => {
    const headers = { "x-forwarded-for": "1.2.3.4" };
    expect(clientKey(make(headers), "rsvp")).not.toBe(
      clientKey(make(headers), "guestbook"),
    );
  });
});
