import {
  getRsvpSummary,
  listInvitesForAdmin,
  listMessagesForReview,
  listSeatingTables,
} from "@/db/queries";
import { AdminDashboard } from "@/components/admin/AdminDashboard";

/**
 * Operator dashboard.
 *
 * Reached only through `middleware.ts`, which verifies the signed session cookie
 * before this file is ever evaluated.
 *
 * The initial data is loaded here on the server in one pass so the dashboard is
 * useful on first paint; the client component takes over for search and the
 * mutations. `no-store` because stale RSVP numbers on event day are worse than
 * useless — they are misleading.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const [summary, messages, invites, tables] = await Promise.all([
    getRsvpSummary(),
    listMessagesForReview(),
    listInvitesForAdmin(),
    listSeatingTables(),
  ]);

  return (
    <AdminDashboard
      summary={summary}
      initialMessages={messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
      }))}
      invites={invites.map((i) => ({
        ...i,
        respondedAt: i.respondedAt ? i.respondedAt.toISOString() : null,
      }))}
      tables={tables}
    />
  );
}
