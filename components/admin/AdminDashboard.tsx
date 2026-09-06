"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * The operator dashboard.
 *
 * Three jobs, in the order they actually get used:
 *   1. Know the numbers at a glance (headcount drives the caterer).
 *   2. Clear the guestbook queue.
 *   3. Find a guest, and seat a party.
 *
 * Mutations are optimistic-free on purpose: each action awaits the server and
 * then reflects the real result. On event day a moderation button that *looks*
 * like it worked but did not is worse than one that takes 300ms.
 */

type Summary = {
  attending: number;
  declined: number;
  pending: number;
  invitesTotal: number;
  invitesResponded: number;
  seatsAllocated: number;
  messagesPending: number;
  messagesApproved: number;
};

type Message = {
  id: number;
  authorName: string;
  body: string;
  isApproved: boolean;
  createdAt: string;
};

type InviteRow = {
  id: number;
  rsvpCode: string;
  partyName: string;
  maxSeats: number;
  tableId: number | null;
  tableName: string | null;
  respondedAt: string | null;
  attending: number;
  declined: number;
  partySize: number;
};

type TableRow = {
  id: number;
  name: string;
  capacity: number;
  locationNote: string | null;
  seated: number;
};

type GuestHit = {
  guestId: number;
  fullName: string;
  rsvpStatus: string;
  partyName: string;
  rsvpCode: string;
  tableId: number | null;
};

export function AdminDashboard({
  summary,
  initialMessages,
  invites,
  tables,
}: {
  summary: Summary;
  initialMessages: Message[];
  invites: InviteRow[];
  tables: TableRow[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function moderate(id: number, isApproved: boolean) {
    setBusyId(id);
    try {
      const response = await fetch("/api/admin/guestbook", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isApproved }),
      });
      if (response.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, isApproved } : m)),
        );
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    setBusyId(id);
    try {
      const response = await fetch("/api/admin/guestbook", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  const pendingMessages = messages.filter((m) => !m.isApproved);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-light text-burgundy">Admin</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-full border border-hairline px-4 py-2 text-xs uppercase tracking-wide text-ink-muted transition hover:border-gold"
          >
            View site
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Attending" value={summary.attending} emphasis />
        <Stat label="Declined" value={summary.declined} />
        <Stat label="Awaiting reply" value={summary.pending} />
        <Stat
          label="Parties replied"
          value={`${summary.invitesResponded}/${summary.invitesTotal}`}
        />
      </section>

      <GuestSearch tables={tables} />

      <section className="mt-14">
        <h2 className="text-[0.65rem] uppercase tracking-engraved text-gold">
          Guestbook queue
          {pendingMessages.length > 0 && (
            <span className="ml-2 rounded-full bg-burgundy px-2 py-0.5 text-ivory">
              {pendingMessages.length}
            </span>
          )}
        </h2>

        {messages.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">No messages yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`rounded-sm border px-5 py-4 ${
                  message.isApproved
                    ? "border-hairline bg-ivory"
                    : "border-gold/50 bg-champagne/25"
                }`}
              >
                <p className="text-sm leading-relaxed text-ink">{message.body}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[0.65rem] uppercase tracking-engraved text-ink-muted">
                    {message.authorName}
                    {message.isApproved && " · published"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === message.id}
                      onClick={() => moderate(message.id, !message.isApproved)}
                      className="rounded-full border border-gold/50 px-4 py-1.5 text-xs uppercase tracking-wide text-burgundy transition hover:bg-champagne/50 disabled:opacity-40"
                    >
                      {message.isApproved ? "Unpublish" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === message.id}
                      onClick={() => remove(message.id)}
                      className="rounded-full border border-rose/50 px-4 py-1.5 text-xs uppercase tracking-wide text-rose transition hover:bg-rose/10 disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Seating invites={invites} tables={tables} />
    </main>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number | string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border px-4 py-4 ${
        emphasis ? "border-gold/50 bg-champagne/30" : "border-hairline bg-ivory"
      }`}
    >
      <div className="font-display text-3xl font-light tabular-nums text-burgundy">
        {value}
      </div>
      <div className="mt-1 text-[0.6rem] uppercase tracking-engraved text-ink-muted">
        {label}
      </div>
    </div>
  );
}

function GuestSearch({ tables }: { tables: TableRow[] }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GuestHit[] | null>(null);
  const [searching, setSearching] = useState(false);

  const tableName = (id: number | null) =>
    id ? (tables.find((t) => t.id === id)?.name ?? "—") : "—";

  async function search(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    if (!query.trim()) {
      setHits(null);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `/api/admin/guests?q=${encodeURIComponent(query.trim())}`,
      );
      const data = await response.json();
      setHits(data.ok ? data.guests : []);
    } finally {
      setSearching(false);
    }
  }

  return (
    <section className="mt-14">
      <h2 className="text-[0.65rem] uppercase tracking-engraved text-gold">
        Find a guest
      </h2>

      <form onSubmit={search} className="mt-4 flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name…"
          className="flex-1 rounded-sm border border-hairline bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-gold"
        />
        <button
          type="submit"
          disabled={searching}
          className="rounded-full bg-burgundy px-6 py-2 text-xs uppercase tracking-engraved text-ivory disabled:opacity-40"
        >
          {searching ? "…" : "Search"}
        </button>
      </form>

      {hits !== null && (
        <div className="mt-4 overflow-x-auto">
          {hits.length === 0 ? (
            <p className="text-sm text-ink-muted">No matches.</p>
          ) : (
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="text-[0.6rem] uppercase tracking-engraved text-ink-muted">
                  <th className="pb-2">Guest</th>
                  <th className="pb-2">Party</th>
                  <th className="pb-2">Code</th>
                  <th className="pb-2">Table</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {hits.map((hit) => (
                  <tr key={hit.guestId} className="border-t border-hairline">
                    <td className="py-2 text-burgundy">{hit.fullName}</td>
                    <td className="py-2 text-ink-muted">{hit.partyName}</td>
                    <td className="py-2 font-mono text-xs text-ink-muted">
                      {hit.rsvpCode}
                    </td>
                    <td className="py-2 text-ink-muted">{tableName(hit.tableId)}</td>
                    <td className="py-2 text-ink-muted">{hit.rsvpStatus}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

function Seating({ invites, tables }: { invites: InviteRow[]; tables: TableRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function assign(inviteId: number, tableId: number | null) {
    setBusy(inviteId);
    try {
      await fetch("/api/admin/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId, tableId }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-14">
      <h2 className="text-[0.65rem] uppercase tracking-engraved text-gold">Seating</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        {tables.map((table) => {
          const over = table.seated > table.capacity;
          return (
            <span
              key={table.id}
              // Over-capacity is the one seating error that actually ruins the
              // night, so it is called out rather than left to arithmetic.
              className={`rounded-full border px-3 py-1 text-xs ${
                over
                  ? "border-rose bg-rose/10 text-rose"
                  : "border-hairline bg-ivory text-ink-muted"
              }`}
              title={table.locationNote ?? undefined}
            >
              {table.name}: {table.seated}/{table.capacity}
            </span>
          );
        })}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[38rem] text-left text-sm">
          <thead>
            <tr className="text-[0.6rem] uppercase tracking-engraved text-ink-muted">
              <th className="pb-2">Party</th>
              <th className="pb-2">Code</th>
              <th className="pb-2">Replied</th>
              <th className="pb-2">Seats</th>
              <th className="pb-2">Table</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => (
              <tr key={invite.id} className="border-t border-hairline">
                <td className="py-2 text-burgundy">{invite.partyName}</td>
                <td className="py-2 font-mono text-xs text-ink-muted">
                  {invite.rsvpCode}
                </td>
                <td className="py-2 text-ink-muted">
                  {invite.respondedAt
                    ? `${invite.attending} yes / ${invite.declined} no`
                    : "—"}
                </td>
                <td className="py-2 tabular-nums text-ink-muted">{invite.maxSeats}</td>
                <td className="py-2">
                  <select
                    value={invite.tableId ?? ""}
                    disabled={busy === invite.id}
                    onChange={(e) =>
                      assign(invite.id, e.target.value ? Number(e.target.value) : null)
                    }
                    aria-label={`Table for ${invite.partyName}`}
                    className="rounded-sm border border-hairline bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-gold disabled:opacity-40"
                  >
                    <option value="">Unassigned</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LogoutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
      className="rounded-full border border-hairline px-4 py-2 text-xs uppercase tracking-wide text-ink-muted transition hover:border-gold"
    >
      Sign out
    </button>
  );
}
