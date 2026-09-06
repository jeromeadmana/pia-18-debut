import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Optimistic admin pre-filter.
 *
 * Renamed from `middleware.ts`: Next.js 16 calls this convention Proxy, and the
 * old filename is deprecated. Behaviour is unchanged.
 *
 * **This is a pre-filter, not the authorisation boundary.** Next's own guidance
 * is explicit that Proxy "should not be your only line of defense" — it runs on
 * prefetches, and a bypass here would otherwise expose the entire guest list. So
 * every admin page and route ALSO calls `requireAdminPage` / `requireAdminApi`
 * from `lib/admin-session.ts`, which re-verifies the cookie next to the data.
 *
 * What this layer buys us is a clean redirect for a human who wandered in
 * logged-out, and one cheap central place to short-circuit unauthorised traffic
 * before it reaches a function. It only ever reads the cookie — no database work,
 * per the same guidance.
 */

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();

  const authorised = await verifySessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (authorised) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, message: "Not authorised." },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/admin/login", request.url);
  // Remember where they were headed, but only ever a same-site path.
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
