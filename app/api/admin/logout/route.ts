import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** POST /api/admin/logout — clear the session cookie. */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  // maxAge 0 expires it immediately; the other attributes must match the ones
  // used at login or the browser keeps the original cookie.
  response.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return response;
}
