import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin-session";
import { z } from "zod";
import { deleteMessage, listMessagesForReview, setMessageApproval } from "@/db/queries";
import { isConnectionError } from "@/db/client";

/**
 * Guestbook moderation.
 *
 * `proxy.ts` pre-filters unauthorised traffic; every handler below re-verifies
 * the session via `requireAdminApi` so the proxy is never the only guard.
 */
export const maxDuration = 10;
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  id: z.number().int().positive(),
  isApproved: z.boolean(),
});

const deleteSchema = z.object({ id: z.number().int().positive() });

export async function GET() {
  // Defence in depth: proxy.ts already filtered this, but the
  // authorisation boundary lives here, next to the data.
  const denied = await requireAdminApi();
  if (denied) return denied;

  try {
    return NextResponse.json({ ok: true, messages: await listMessagesForReview() });
  } catch (error) {
    console.error("[admin/guestbook] read failed", error);
    return NextResponse.json(
      { ok: false, message: "Couldn't load messages." },
      { status: isConnectionError(error) ? 503 : 500 },
    );
  }
}

/** Approve or un-approve. Un-approving is a real need: it retracts a mistake. */
export async function PATCH(request: Request) {
  // Defence in depth: proxy.ts already filtered this, but the
  // authorisation boundary lives here, next to the data.
  const denied = await requireAdminApi();
  if (denied) return denied;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  try {
    const row = await setMessageApproval(parsed.data.id, parsed.data.isApproved);
    if (!row) {
      return NextResponse.json({ ok: false, message: "No such message." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, message: row });
  } catch (error) {
    console.error("[admin/guestbook] update failed", error);
    return NextResponse.json({ ok: false, message: "Update failed." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  // Defence in depth: proxy.ts already filtered this, but the
  // authorisation boundary lives here, next to the data.
  const denied = await requireAdminApi();
  if (denied) return denied;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = deleteSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  try {
    const row = await deleteMessage(parsed.data.id);
    if (!row) {
      return NextResponse.json({ ok: false, message: "No such message." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: row.id });
  } catch (error) {
    console.error("[admin/guestbook] delete failed", error);
    return NextResponse.json({ ok: false, message: "Delete failed." }, { status: 500 });
  }
}
