import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  createSessionToken,
  sessionCookieOptions,
  verifyAdminPassword,
} from "@/lib/auth";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/admin/login
 *
 * This is the one endpoint `middleware.ts` lets through unauthenticated, so it
 * is the only brute-force surface on the admin side. Five attempts per fifteen
 * minutes makes guessing a decent password impractical while never getting in
 * the way of an operator who fat-fingered it twice.
 */
export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "admin-login"), {
    limit: 5,
    windowMs: 15 * 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  if (typeof password !== "string" || !(await verifyAdminPassword(password))) {
    // One generic message: never reveal whether ADMIN_PASSWORD is even set.
    return NextResponse.json(
      { ok: false, message: "That password is not correct." },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(),
    sessionCookieOptions(SESSION_TTL_MS / 1000),
  );
  return response;
}
