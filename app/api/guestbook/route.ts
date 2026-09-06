import { NextResponse } from "next/server";
import { createGuestbookMessage, listApprovedMessages } from "@/db/queries";
import { guestbookSubmissionSchema } from "@/lib/validation";
import { isConnectionError } from "@/db/client";
import { event } from "@/content/event.config";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

/** GET /api/guestbook — approved wishes, newest first. */
export async function GET() {
  try {
    const messages = await listApprovedMessages();
    return NextResponse.json({ ok: true, messages });
  } catch (error) {
    console.error("[guestbook] read failed", error);
    return NextResponse.json(
      { ok: false, message: "Couldn't load the wishes just now." },
      { status: isConnectionError(error) ? 503 : 500 },
    );
  }
}

/**
 * POST /api/guestbook — leave a wish.
 *
 * Always stored unapproved. The response deliberately says the message is
 * "waiting to be added" rather than implying it is already live.
 */
export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "We couldn't read that request." },
      { status: 400 },
    );
  }

  const parsed = guestbookSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Please check your message and try again.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  try {
    const { id } = await createGuestbookMessage(parsed.data);
    return NextResponse.json(
      { ok: true, id, message: event.guestbook.moderationNotice },
      { status: 201 },
    );
  } catch (error) {
    console.error("[guestbook] write failed", error);
    return NextResponse.json(
      { ok: false, message: "Something went wrong saving your message." },
      { status: isConnectionError(error) ? 503 : 500 },
    );
  }
}
