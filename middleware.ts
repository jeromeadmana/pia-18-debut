import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/**
 * Gate every admin surface at the edge.
 *
 * Doing this in middleware rather than per-page matters: a new admin route added
 * later is protected by default instead of protected only if someone remembered
 * the check. The matcher is deny-by-prefix, so the only way to expose something
 * under /admin is to deliberately add it to the public list below.
 *
 * Pages redirect to the login screen; API routes get a 401 rather than an HTML
 * redirect, so a fetch from the dashboard fails cleanly.
 */

const PUBLIC_ADMIN_PATHS = new Set(["/admin/login", "/api/admin/login"]);

export async function middleware(request: NextRequest) {
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
