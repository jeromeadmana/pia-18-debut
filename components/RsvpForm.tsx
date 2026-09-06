"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { event } from "@/content/event.config";

/**
 * The RSVP form.
 *
 * Design rules this encodes:
 *
 *  - **Declining is a first-class choice, not a hidden link.** Both options are
 *    equally weighted buttons. A guest who cannot come should not have to hunt.
 *  - **The seat budget is visible while you edit**, not revealed as an error on
 *    submit. The server still enforces it (`checkSeatLimit`), but a guest should
 *    never be surprised by it.
 *  - **Dietary notes only appear for guests marked attending** — asking someone
 *    who just declined about their allergies is noise.
 *  - Every control clears 44px for thumbs, and state changes are plain colour
 *    swaps rather than animation, so this stays cheap on the mid-range Android
 *    phones most guests will actually use.
 */

type Status = "pending" | "attending" | "declined";

type GuestInput = {
  id: number;
  fullName: string;
  rsvpStatus: Status;
  dietaryNotes: string | null;
};

type Props = {
  code: string;
  maxSeats: number;
  hasResponded: boolean;
  guests: GuestInput[];
  existingSongs: { id: number; title: string; artist: string | null }[];
};

type SongDraft = { title: string; artist: string };

const MAX_SONGS = 3;

export function RsvpForm({ code, maxSeats, hasResponded, guests, existingSongs }: Props) {
  const router = useRouter();

  const [responses, setResponses] = useState<GuestInput[]>(guests);
  const [songs, setSongs] = useState<SongDraft[]>(
    existingSongs.length > 0
      ? existingSongs.map((s) => ({ title: s.title, artist: s.artist ?? "" }))
      : [{ title: "", artist: "" }],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    attending: number;
    declined: number;
  } | null>(null);

  const attendingCount = responses.filter((r) => r.rsvpStatus === "attending").length;
  const overBudget = attendingCount > maxSeats;
  const anyAnswered = responses.some((r) => r.rsvpStatus !== "pending");

  function setStatus(id: number, status: Status) {
    setResponses((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              rsvpStatus: status,
              // Drop dietary notes when someone switches to declining, so we
              // never store a note against a guest who is not coming.
              dietaryNotes: status === "attending" ? g.dietaryNotes : null,
            }
          : g,
      ),
    );
    if (error) setError(null);
  }

  function setDietary(id: number, value: string) {
    setResponses((prev) => prev.map((g) => (g.id === id ? { ...g, dietaryNotes: value } : g)));
  }

  function updateSong(index: number, patch: Partial<SongDraft>) {
    setSongs((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);

    if (!anyAnswered) {
      setError("Please let us know who can join us.");
      return;
    }
    if (overBudget) {
      setError(
        `This invitation is for ${maxSeats} ${maxSeats === 1 ? "seat" : "seats"}. ` +
          `Please contact ${event.rsvp.contactName} to request more.`,
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          guests: responses
            .filter((g) => g.rsvpStatus !== "pending")
            .map((g) => ({
              guestId: g.id,
              status: g.rsvpStatus,
              dietaryNotes: g.dietaryNotes?.trim() || null,
            })),
          songRequests: songs
            .filter((s) => s.title.trim().length > 0)
            .map((s) => ({ title: s.title.trim(), artist: s.artist.trim() || null })),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        // The API returns a guest-readable message on every failure path,
        // including seat overruns (409) and database unavailability (503).
        setError(data?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setConfirmed({ attending: data.attending, declined: data.declined });
      // Refresh the server component so the page reflects saved state if the
      // guest navigates back to it.
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmed) {
    return <Confirmation {...confirmed} onEdit={() => setConfirmed(null)} />;
  }

  return (
    <form onSubmit={handleSubmit} className="mt-12">
      <header className="flex items-baseline justify-between">
        <h2 className="text-[0.65rem] uppercase tracking-engraved text-gold">
          {hasResponded ? "Update your reply" : "Kindly reply"}
        </h2>
        <p
          className={`text-xs tabular-nums ${
            overBudget ? "font-medium text-rose" : "text-ink-muted"
          }`}
        >
          {attendingCount} of {maxSeats} {maxSeats === 1 ? "seat" : "seats"}
        </p>
      </header>

      <ul className="mt-5 space-y-5">
        {responses.map((guest) => (
          <li key={guest.id} className="border-b border-hairline pb-5 last:border-0">
            <p className="font-display text-lg text-burgundy">{guest.fullName}</p>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <ChoiceButton
                selected={guest.rsvpStatus === "attending"}
                onClick={() => setStatus(guest.id, "attending")}
              >
                Joyfully accepts
              </ChoiceButton>
              <ChoiceButton
                selected={guest.rsvpStatus === "declined"}
                onClick={() => setStatus(guest.id, "declined")}
              >
                Regretfully declines
              </ChoiceButton>
            </div>

            {guest.rsvpStatus === "attending" && (
              <input
                type="text"
                value={guest.dietaryNotes ?? ""}
                onChange={(e) => setDietary(guest.id, e.target.value)}
                maxLength={280}
                placeholder="Any dietary needs? (optional)"
                aria-label={`Dietary needs for ${guest.fullName}`}
                className="mt-3 w-full rounded-sm border border-hairline bg-white px-3 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-gold"
              />
            )}
          </li>
        ))}
      </ul>

      {attendingCount > 0 && (
        <section className="mt-8">
          <h3 className="text-[0.65rem] uppercase tracking-engraved text-gold">
            Request a song
          </h3>
          <p className="mt-2 text-xs text-ink-muted">
            Up to {MAX_SONGS}. What would get you onto the dance floor?
          </p>

          <div className="mt-4 space-y-2">
            {songs.map((song, index) => (
              <div key={index} className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={song.title}
                  onChange={(e) => updateSong(index, { title: e.target.value })}
                  maxLength={120}
                  placeholder="Song title"
                  aria-label={`Song ${index + 1} title`}
                  className="rounded-sm border border-hairline bg-white px-3 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-gold"
                />
                <input
                  type="text"
                  value={song.artist}
                  onChange={(e) => updateSong(index, { artist: e.target.value })}
                  maxLength={120}
                  placeholder="Artist (optional)"
                  aria-label={`Song ${index + 1} artist`}
                  className="rounded-sm border border-hairline bg-white px-3 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-gold"
                />
              </div>
            ))}
          </div>

          {songs.length < MAX_SONGS && (
            <button
              type="button"
              onClick={() => setSongs((prev) => [...prev, { title: "", artist: "" }])}
              className="mt-3 text-xs uppercase tracking-wide text-gold underline-offset-4 hover:underline"
            >
              + Add another
            </button>
          )}
        </section>
      )}

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-sm border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-burgundy"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || overBudget}
        className="mt-8 min-h-12 w-full rounded-full bg-burgundy px-8 py-4 text-sm uppercase tracking-engraved text-ivory transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Sending…" : hasResponded ? "Update reply" : "Send reply"}
      </button>

      <p className="mt-4 text-center text-xs text-ink-muted">
        Kindly reply by {event.rsvp.deadlineDisplay}. You can change your answer any
        time before then.
      </p>
    </form>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 rounded-sm border px-3 py-3 text-xs uppercase tracking-wide transition ${
        selected
          ? "border-burgundy bg-burgundy text-ivory"
          : "border-hairline bg-white text-ink-muted hover:border-gold"
      }`}
    >
      {children}
    </button>
  );
}

function Confirmation({
  attending,
  declined,
  onEdit,
}: {
  attending: number;
  declined: number;
  onEdit: () => void;
}) {
  return (
    <section
      className="mt-12 rounded-sm border border-gold/40 bg-champagne/25 px-6 py-10 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-[0.65rem] uppercase tracking-engraved text-gold">
        Your reply is recorded
      </p>

      <p className="mt-4 font-display text-3xl font-light text-burgundy">
        {attending > 0 ? "We can't wait to see you." : "You will be dearly missed."}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-ink-muted">
        {attending > 0 ? (
          <>
            {attending} {attending === 1 ? "guest" : "guests"} attending
            {declined > 0 ? `, ${declined} unable to join` : ""}.
          </>
        ) : (
          <>Thank you for letting us know. {event.celebrant.firstName} will miss you.</>
        )}
      </p>

      <button
        type="button"
        onClick={onEdit}
        className="mt-6 text-xs uppercase tracking-wide text-gold underline-offset-4 hover:underline"
      >
        Change your answer
      </button>
    </section>
  );
}
