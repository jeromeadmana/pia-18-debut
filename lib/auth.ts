/**
 * Admin session auth.
 *
 * Threat model: the admin surface exposes the complete guest list, every RSVP,
 * and table assignments. That is exactly the data the invite-code design exists
 * to keep private, so this gate has to actually hold — but the site has one
 * operator, so a full identity system would be ceremony without benefit.
 *
 * The design: a single shared password proves you are the operator once, and
 * from then on an HMAC-signed, httpOnly cookie carries the session. The cookie
 * contains only an expiry timestamp and its signature — no password, no
 * reversible payload — so stealing it gains an attacker nothing after it lapses.
 *
 * Built on Web Crypto rather than node:crypto so the same code runs in
 * middleware (Edge runtime) and in route handlers.
 */

const encoder = new TextEncoder();

export const SESSION_COOKIE = "pia_admin";

/** Eight hours: long enough to run an event, short enough to matter if leaked. */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function requireSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  // Failing closed is the whole point: without a secret we cannot sign anything,
  // and defaulting to a constant would make every deployment forgeable.
  if (!secret || secret.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET is missing or too short (need >= 32 chars). " +
        "Generate one with: node -e \"console.log(crypto.randomUUID()+crypto.randomUUID())\"",
    );
  }
  return secret;
}

function base64url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(requireSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
}

/**
 * Constant-time string comparison.
 *
 * A plain `===` short-circuits on the first differing byte, which leaks how much
 * of a forged signature was correct and makes the HMAC guessable byte by byte.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/** Mint a signed session value. The payload is just the expiry instant. */
export async function createSessionToken(now: number = Date.now()): Promise<string> {
  const expiresAt = String(now + SESSION_TTL_MS);
  return `${expiresAt}.${await sign(expiresAt)}`;
}

/** Verify signature first, then expiry. Any malformed input is simply false. */
export async function verifySessionToken(
  token: string | undefined,
  now: number = Date.now(),
): Promise<boolean> {
  if (!token) return false;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: string;
  try {
    expected = await sign(payload);
  } catch {
    // No secret configured — fail closed rather than letting anyone in.
    return false;
  }

  if (!timingSafeEqual(signature, expected)) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > now;
}

/**
 * Check the operator password.
 *
 * Compared via HMAC digests rather than raw strings so the comparison is both
 * constant-time and length-independent.
 */
export async function verifyAdminPassword(candidate: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || expected.length === 0) return false;
  if (typeof candidate !== "string" || candidate.length === 0) return false;

  const [a, b] = await Promise.all([sign(`pw:${candidate}`), sign(`pw:${expected}`)]);
  return timingSafeEqual(a, b);
}

/** Cookie attributes. Shared so login and logout cannot drift apart. */
export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
