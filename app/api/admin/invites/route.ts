import { NextResponse } from "next/server";
import { z } from "zod";
import { assignTable } from "@/db/queries";

/**
 * PATCH /api/admin/invites — move a party to a table, or clear the assignment.
 * Gated by `middleware.ts`.
 */
export const maxDuration = 10;
export const dynamic = "force-dynamic";

const schema = z.object({
  inviteId: z.number().int().positive(),
  // null clears the assignment, which is a deliberate action rather than an
  // absent field — so `null` is accepted but `undefined` is not.
  tableId: z.number().int().positive().nullable(),
});

export async function PATCH(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Bad request." }, { status: 400 });
  }

  try {
    const row = await assignTable(parsed.data.inviteId, parsed.data.tableId);
    if (!row) {
      return NextResponse.json({ ok: false, message: "No such invite." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, invite: row });
  } catch (error) {
    // A bad tableId trips the foreign key rather than silently orphaning a party.
    console.error("[admin/invites] assign failed", error);
    return NextResponse.json(
      { ok: false, message: "Couldn't assign that table." },
      { status: 400 },
    );
  }
}
