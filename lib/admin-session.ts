import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./auth";

/**
 * The actual admin authorisation boundary.
 *
 * `proxy.ts` pre-filters unauthorised traffic, but Next's guidance is that Proxy
 * must not be the only line of defence — the real check belongs as close to the
 * data as possible. These helpers are that check, and every admin page and route
 * handler calls one of them regardless of what the proxy already did.
 *
 * The duplication is the point. If the proxy matcher is ever edited, a route is
 * moved outside `/admin`, or a framework-level bypass turns up, the guest list is
 * still not readable.
 *
 * `cache` memoises within a single render pass, so a page that checks the session
 * and then renders components that check it again pays for one verification.
 */

export const isAdminAuthenticated = cache(async (): Promise<boolean> => {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
});

/**
 * For server components. Redirects to the login screen when unauthenticated —
 * `redirect` throws, so nothing after this call runs for an anonymous visitor.
 */
export async function requireAdminPage(): Promise<void> {
  if (!(await isAdminAuthenticated())) redirect("/admin/login");
}

/**
 * For route handlers. Returns a 401 response to hand straight back, or null when
 * the caller may proceed.
 *
 * Deliberately returns rather than throws so each handler's early-return reads
 * plainly at the top of the function:
 *
 *     const denied = await requireAdminApi();
 *     if (denied) return denied;
 */
export async function requireAdminApi(): Promise<NextResponse | null> {
  if (await isAdminAuthenticated()) return null;

  return NextResponse.json(
    { ok: false, message: "Not authorised." },
    { status: 401 },
  );
}
