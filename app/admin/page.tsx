import {
  getRsvpSummary,
  listInvitesForAdmin,
  listMessagesForReview,
  listSeatingTables,
} from "@/db/queries";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { requireAdminPage } from "@/lib/admin-session";

/**
 * Operator dashboard.
 *
 * `proxy.ts` pre-filters anonymous traffic, and `requireAdminPage` below is the
 * authorisation boundary proper — this page must not rely on the proxy alone.
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
  // Re-verified here, not just in proxy.ts — this page reads the whole guest
  // list, so it must not depend on an upstream filter having run.
  await requireAdminPage();

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
