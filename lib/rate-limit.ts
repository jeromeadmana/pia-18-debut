/**
 * Best-effort in-memory rate limiting for the public write endpoints.
 *
 * **Read this before trusting it.** Vercel runs each function in its own
 * isolate, and isolates neither share memory nor persist between cold starts.
 * So this limits per instance, not globally: a determined attacker who spreads
 * requests across concurrently-warm isolates gets a multiple of the stated
 * budget, and every cold start resets the window.
 *
 * It is still worth having. It stops the realistic failure modes for an event
 * site — a double-tapped submit button, a stuck retry loop, one bored guest
 * hammering the guestbook — at zero cost and zero dependencies.
 *
 * If this ever needs to be a real control (it would, if the site were public and
 * indexed), the fix is a shared store: Upstash Redis or Vercel KV keyed the same
 * way. The call sites do not change.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Stop the Map growing without bound across a long-lived warm instance. */
function evictExpired(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets. Suitable for a Retry-After header. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  evictExpired(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  existing.count++;

  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  return { ok: true, remaining: limit - existing.count, retryAfter: 0 };
}

/**
 * Derive a client key from proxy headers.
 *
 * `x-forwarded-for` is client-controllable in general, but on Vercel the
 * platform overwrites it at the edge, so the leftmost entry is trustworthy
 * there. Everything collapses to a shared bucket when no header is present,
 * which is the safe direction to fail (over-limiting, never under-limiting).
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  return `${scope}:${ip}`;
}

/** Reset all buckets. Test-only. */
export function __resetRateLimits() {
  buckets.clear();
}
