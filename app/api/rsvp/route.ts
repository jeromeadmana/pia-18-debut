import { NextResponse } from "next/server";
import { submitRsvp } from "@/db/queries";
import { rsvpSubmissionSchema } from "@/lib/validation";
import { isConnectionError } from "@/db/client";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/rsvp — record a party's response.
 *
 * Vercel Hobby kills functions at 10s. Declaring it here makes that ceiling
 * explicit rather than a surprise, and the work inside is two round trips at
 * most (one read, one batched write).
 */
export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  // A party may legitimately revise its answer a few times; 10 per minute is
  // far above real use and well below anything that could hammer the database.
  const limit = rateLimit(clientKey(request, "rsvp"), { limit: 10, windowMs: 60_000 });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, message: "That's a few too many attempts. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "We couldn't read that request." },
      { status: 400 },
    );
  }

  const parsed = rsvpSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Please check the form and try again.",
        // Field-level messages so the client can highlight the offending input.
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const { code, guests, songRequests } = parsed.data;

  try {
    const result = await submitRsvp(code, guests, songRequests);

    if (!result.ok) {
      // A bad code is a 404; a seat overrun is a 409 (the request was
      // well-formed, it just conflicts with the allocation).
      const status = result.reason === "not_found" ? 404 : 409;
      return NextResponse.json(
        { ok: false, reason: result.reason, message: result.message },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      attending: result.attending,
      declined: result.declined,
    });
  } catch (error) {
    // Never leak driver internals to a guest, but keep them in the server log.
    console.error("[rsvp] submission failed", error);

    if (isConnectionError(error)) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "We couldn't reach the guest list just now. Please try again in a moment.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { ok: false, message: "Something went wrong saving your reply." },
      { status: 500 },
    );
  }
}
