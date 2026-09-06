import { NextResponse } from "next/server";
import { searchGuestsByName } from "@/db/queries";
import { isConnectionError } from "@/db/client";

/**
 * GET /api/admin/guests?q=… — operator guest search.
 *
 * This is the endpoint that would make the entire guest list enumerable if it
 * ever escaped the admin gate. It exists ONLY under /api/admin so that
 * `middleware.ts` covers it by prefix; do not move or duplicate it elsewhere.
 */
export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";

  // An empty query returns nothing rather than the whole table — the operator
  // should search deliberately, and it keeps the response small.
  if (query.trim().length === 0) {
    return NextResponse.json({ ok: true, guests: [] });
  }

  try {
    return NextResponse.json({ ok: true, guests: await searchGuestsByName(query) });
  } catch (error) {
    console.error("[admin/guests] search failed", error);
    return NextResponse.json(
      { ok: false, message: "Search failed." },
      { status: isConnectionError(error) ? 503 : 500 },
    );
  }
}
