import { NextResponse } from "next/server";
import { createUploadTicket } from "@/lib/cloudinary-sign";
import { clientKey, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/wishes/sign — mint a one-shot signed upload ticket.
 *
 * The browser uploads the recording straight to Cloudinary with this; the audio
 * never passes through Vercel, which would cap it at a 4.5 MB body and a 10s
 * function.
 *
 * The folder and public ID are decided HERE and covered by the signature, so a
 * caller cannot redirect the upload elsewhere on this shared account or name it
 * over an existing asset. The api secret is never sent.
 *
 * Rate limited hard: this endpoint hands out write capability to a third-party
 * store, so it is the most abusable route on the site. Three per five minutes is
 * far above one guest recording a wish and far below anything that could fill
 * the folder.
 */
export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limit = rateLimit(clientKey(request, "wish-sign"), {
    limit: 3,
    windowMs: 5 * 60_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, message: "Please wait a moment before recording again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  try {
    return NextResponse.json({ ok: true, ticket: createUploadTicket() });
  } catch (error) {
    // A missing or malformed CLOUDINARY_URL is a deployment problem, not
    // something a guest can fix — log it and say the feature is unavailable.
    console.error("[wishes/sign] could not create ticket", error);
    return NextResponse.json(
      { ok: false, message: "Voice wishes aren't available right now." },
      { status: 503 },
    );
  }
}
