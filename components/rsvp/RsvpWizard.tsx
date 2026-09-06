"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { event } from "@/content/event.config";
import { cn } from "@/lib/utils";
import { StepHeader, StepNav, StepWizard, type Step } from "./StepWizard";

/**
 * The RSVP, as four steps instead of one long form.
 *
 * Why split it: the single form asked a guest to answer for everyone, declare
 * allergies, and think of a song before it would accept anything. Four screens
 * each ask one question, and only the first is mandatory — a guest who just
 * wants to say "yes, two of us" can be done in two taps.
 *
 * State lives here, not in the step components, so validation and submission
 * happen in one place. `StepWizard` is presentation only.
 *
 * Submission reuses the existing, tested `/api/rsvp` route unchanged. The
 * private note posts separately to `/api/guestbook` with `isPrivate`, because a
 * note for Pia is not part of the seating/catering data and should not be able
 * to fail an RSVP.
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
  rsvpClosed: boolean;
  guests: GuestInput[];
  existingSongs: { id: number; title: string; artist: string | null }[];
  /** Entourage members get the formal guidance; everyone else the relaxed one. */
  isEntourage: boolean;
};

const STEPS: readonly Step[] = [
  { id: "attending", label: "Attendance" },
  { id: "dietary", label: "Dietary" },
  { id: "attire", label: "Attire" },
  { id: "extras", label: "Song & Note" },
];

const MAX_SONGS = 3;

export function RsvpWizard({
  code,
  maxSeats,
  hasResponded,
  rsvpClosed,
  guests,
  existingSongs,
  isEntourage,
}: Props) {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [responses, setResponses] = useState<GuestInput[]>(guests);
  const [songs, setSongs] = useState(
    existingSongs.length > 0
      ? existingSongs.map((s) => ({ title: s.title, artist: s.artist ?? "" }))
      : [{ title: "", artist: "" }],
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ attending: number; declined: number } | null>(null);

  const attending = responses.filter((r) => r.rsvpStatus === "attending");
  const overBudget = attending.length > maxSeats;
  const anyAnswered = responses.some((r) => r.rsvpStatus !== "pending");

  function setStatus(id: number, status: Status) {
    setResponses((prev) =>
      prev.map((g) =>
        g.id === id
          ? {
              ...g,
              rsvpStatus: status,
              // Never keep a dietary note against someone who is not coming.
              dietaryNotes: status === "attending" ? g.dietaryNotes : null,
            }
          : g,
      ),
    );
    setError(null);
  }

  async function submit() {
    setError(null);
    setBusy(true);

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
            .filter((s) => s.title.trim())
            .map((s) => ({ title: s.title.trim(), artist: s.artist.trim() || null })),
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data?.message ?? "Something went wrong. Please try again.");
        return;
      }

      // Fire-and-forget by design: the RSVP is already saved, and a failed note
      // must not make the guest think their reply did not land.
      if (note.trim()) {
        void fetch("/api/guestbook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authorName: responses[0]?.fullName ?? "A guest",
            body: note.trim(),
            code,
            isPrivate: true,
          }),
        }).catch(() => {});
      }

      setDone({ attending: data.attending, declined: data.declined });
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Please check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (rsvpClosed) return <ClosedSummary guests={guests} hasResponded={hasResponded} />;
  if (done) return <Confirmation {...done} code={code} onEdit={() => setDone(null)} />;

  return (
    <section className="mt-12">
      <StepWizard steps={STEPS} current={step} onJump={setStep}>
        {step === 0 && (
          <>
            <StepHeader
              title={hasResponded ? "Update your reply" : "Will you join us?"}
              hint={`This invitation is for ${maxSeats} ${maxSeats === 1 ? "seat" : "seats"}.`}
            />

            <p
              className={cn(
                "mt-4 text-xs tabular-nums",
                overBudget ? "font-medium text-rose" : "text-muted",
              )}
            >
              {attending.length} of {maxSeats} attending
            </p>

            <ul className="mt-6 space-y-5">
              {responses.map((guest) => (
                <li key={guest.id} className="border-b border-hairline pb-5 last:border-0">
                  <p className="font-display text-lg text-foreground">{guest.fullName}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Choice
                      selected={guest.rsvpStatus === "attending"}
                      onClick={() => setStatus(guest.id, "attending")}
                    >
                      Joyfully accepts
                    </Choice>
                    <Choice
                      selected={guest.rsvpStatus === "declined"}
                      onClick={() => setStatus(guest.id, "declined")}
                    >
                      Regretfully declines
                    </Choice>
                  </div>
                </li>
              ))}
            </ul>

            {error && <ErrorNote>{error}</ErrorNote>}

            <StepNav
              onNext={() => {
                if (!anyAnswered) return setError("Please let us know who can join us.");
                if (overBudget) {
                  return setError(
                    `This invitation is for ${maxSeats} ${maxSeats === 1 ? "seat" : "seats"}. Please contact ${event.rsvp.contactName} to request more.`,
                  );
                }
                setStep(attending.length > 0 ? 1 : 3);
              }}
              nextDisabled={overBudget}
            />
          </>
        )}

        {step === 1 && (
          <>
            <StepHeader
              title="Anything we should know?"
              hint="Allergies or dietary needs, so the kitchen can plan. Leave blank if not."
            />
            <ul className="mt-6 space-y-4">
              {attending.map((guest) => (
                <li key={guest.id}>
                  <label
                    htmlFor={`diet-${guest.id}`}
                    className="text-[0.65rem] uppercase tracking-engraved text-muted"
                  >
                    {guest.fullName}
                  </label>
                  <input
                    id={`diet-${guest.id}`}
                    type="text"
                    value={guest.dietaryNotes ?? ""}
                    maxLength={280}
                    placeholder="No shellfish, vegetarian…"
                    onChange={(e) =>
                      setResponses((prev) =>
                        prev.map((g) =>
                          g.id === guest.id ? { ...g, dietaryNotes: e.target.value } : g,
                        ),
                      )
                    }
                    className="mt-2 w-full rounded-sm border border-hairline bg-background px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
                  />
                </li>
              ))}
            </ul>
            <StepNav onBack={() => setStep(0)} onNext={() => setStep(2)} />
          </>
        )}

        {step === 2 && (
          <>
            <StepHeader
              title="What to wear"
              hint={
                isEntourage
                  ? "You are part of the ceremony, so the formal guidance applies to you."
                  : "There is no dress code for guests — this is only a hint."
              }
            />

            <div className="mt-6 rounded-sm border border-hairline p-5">
              <p className="font-display text-xl text-foreground">
                {isEntourage
                  ? event.attire.entourage.dressCode
                  : event.attire.guests.dressCode}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {isEntourage
                  ? event.attire.entourage.guidance
                  : event.attire.guests.guidance}
              </p>

              <ul className="mt-6 flex flex-wrap gap-3">
                {event.attire.palette.map((swatch) => (
                  <li key={swatch.name} className="flex flex-col items-center gap-1.5">
                    <span
                      className="block h-9 w-9 rounded-full ring-1 ring-inset ring-black/10"
                      style={{ backgroundColor: swatch.hex }}
                    />
                    <span className="text-[0.55rem] uppercase tracking-wide text-muted">
                      {swatch.name}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-5 text-xs text-muted">
                Kindly avoid{" "}
                {event.attire.avoid.map((a) => a.name.toLowerCase()).join(" and ")} — they
                read as competing with the debutante in photographs.
              </p>
            </div>

            <StepNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </>
        )}

        {step === 3 && (
          <>
            <StepHeader
              title="One last thing"
              hint="Both optional — skip straight to sending if you like."
            />

            {attending.length > 0 && (
              <div className="mt-6">
                <p className="text-[0.65rem] uppercase tracking-engraved text-accent">
                  Request a song
                </p>
                <div className="mt-3 space-y-2">
                  {songs.map((song, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={song.title}
                        maxLength={120}
                        placeholder="Song title"
                        aria-label={`Song ${i + 1} title`}
                        onChange={(e) =>
                          setSongs((p) =>
                            p.map((s, j) => (j === i ? { ...s, title: e.target.value } : s)),
                          )
                        }
                        className="rounded-sm border border-hairline bg-background px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
                      />
                      <input
                        type="text"
                        value={song.artist}
                        maxLength={120}
                        placeholder="Artist (optional)"
                        aria-label={`Song ${i + 1} artist`}
                        onChange={(e) =>
                          setSongs((p) =>
                            p.map((s, j) => (j === i ? { ...s, artist: e.target.value } : s)),
                          )
                        }
                        className="rounded-sm border border-hairline bg-background px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
                      />
                    </div>
                  ))}
                </div>
                {songs.length < MAX_SONGS && (
                  <button
                    type="button"
                    onClick={() => setSongs((p) => [...p, { title: "", artist: "" }])}
                    className="mt-3 text-xs uppercase tracking-wide text-accent underline-offset-4 hover:underline"
                  >
                    + Add another
                  </button>
                )}
              </div>
            )}

            <div className="mt-8">
              <label
                htmlFor="private-note"
                className="text-[0.65rem] uppercase tracking-engraved text-accent"
              >
                A note for {event.celebrant.firstName}
              </label>
              <p className="mt-1 text-xs text-muted">
                Private — this one is for her alone and never appears on the wishes wall.
              </p>
              <textarea
                id="private-note"
                value={note}
                rows={4}
                maxLength={event.guestbook.maxLength}
                onChange={(e) => setNote(e.target.value)}
                className="mt-3 w-full resize-y rounded-sm border border-hairline bg-background px-3 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
              />
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            <StepNav
              onBack={() => setStep(attending.length > 0 ? 2 : 0)}
              onNext={submit}
              nextLabel={hasResponded ? "Update reply" : "Send reply"}
              busy={busy}
            />
          </>
        )}
      </StepWizard>
    </section>
  );
}

function Choice({
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
      className={cn(
        "min-h-12 rounded-sm border px-3 py-3 text-xs uppercase tracking-wide transition",
        selected
          ? "border-foreground bg-foreground text-background"
          : "border-hairline text-muted hover:border-accent",
      )}
    >
      {children}
    </button>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-6 rounded-sm border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-foreground"
    >
      {children}
    </p>
  );
}

function Confirmation({
  attending,
  declined,
  code,
  onEdit,
}: {
  attending: number;
  declined: number;
  code: string;
  onEdit: () => void;
}) {
  return (
    <section
      className="mt-12 rounded-sm border border-accent/40 px-6 py-10 text-center"
      role="status"
      aria-live="polite"
    >
      <p className="text-[0.6rem] uppercase tracking-editorial text-accent">
        Your reply is recorded
      </p>
      <p className="mt-4 font-display text-3xl font-light text-foreground">
        {attending > 0 ? "We can't wait to see you." : "You will be dearly missed."}
      </p>
      <p className="mt-4 text-sm leading-relaxed text-muted">
        {attending > 0 ? (
          <>
            {attending} {attending === 1 ? "guest" : "guests"} attending
            {declined > 0 ? `, ${declined} unable to join` : ""}.
          </>
        ) : (
          <>Thank you for letting us know. {event.celebrant.firstName} will miss you.</>
        )}
      </p>

      {attending > 0 && (
        <Link
          href={`/i/${code}/pass`}
          className="mt-8 inline-block min-h-12 rounded-full bg-foreground px-8 py-3 text-xs uppercase tracking-engraved text-background transition hover:opacity-90"
        >
          View your guest pass
        </Link>
      )}

      <button
        type="button"
        onClick={onEdit}
        className="mt-6 block w-full text-xs uppercase tracking-wide text-accent underline-offset-4 hover:underline"
      >
        Change your answer
      </button>
    </section>
  );
}

function ClosedSummary({
  guests,
  hasResponded,
}: {
  guests: GuestInput[];
  hasResponded: boolean;
}) {
  return (
    <section className="mt-12">
      <h2 className="text-[0.65rem] uppercase tracking-engraved text-accent">
        Replies are closed
      </h2>
      <ul className="mt-5 space-y-2">
        {guests.map((guest) => (
          <li
            key={guest.id}
            className="flex items-baseline justify-between border-b border-hairline pb-2 text-sm"
          >
            <span className="text-foreground">{guest.fullName}</span>
            <span className="text-[0.7rem] uppercase tracking-wide text-muted">
              {guest.rsvpStatus === "attending"
                ? "Attending"
                : guest.rsvpStatus === "declined"
                  ? "Unable to join"
                  : "No reply recorded"}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs leading-relaxed text-muted">
        {hasResponded
          ? `To change anything now, please contact ${event.rsvp.contactName} at ${event.rsvp.contactPhone}.`
          : `We didn't receive a reply for this invitation. If you can still join us, contact ${event.rsvp.contactName} at ${event.rsvp.contactPhone}.`}
      </p>
    </section>
  );
}
