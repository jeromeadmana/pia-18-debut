import { notFound } from "next/navigation";
import { getInviteByCode } from "@/db/queries";
import { event } from "@/content/event.config";
import { RsvpForm } from "@/components/RsvpForm";
import { isRsvpClosed } from "@/lib/phase";

/**
 * The private invite page.
 *
 * Dynamic, never cached and never indexed: it renders one party's names, table
 * and court role, keyed on the secret in the URL.
 *
 * The whole page is served by a single indexed round trip (see `getInviteByCode`),
 * which is what keeps it inside the 10s function ceiling even when Neon has to
 * wake from suspend.
 *
 * The page itself is a server component; only the RSVP form below it is
 * interactive, so the invite details render before any JavaScript loads.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: PageProps<"/i/[code]">) {
  const { code } = await params;
  const invite = await getInviteByCode(code);

  // A malformed code and an unknown code produce the identical 404, so this
  // page cannot be used to probe which codes exist.
  if (!invite) notFound();

  const courtRoles = invite.guests.flatMap((guest) =>
    guest.courtRoles.map((role) => ({ guest: guest.fullName, ...role })),
  );

  // Anyone on this invitation holding a court role makes the whole party part of
  // the ceremony, so they see the formal guidance. Everyone else is told to come
  // comfortable — which is the answer most guests actually want.
  const attire = courtRoles.length > 0 ? event.attire.entourage : event.attire.guests;

  return (
    <main className="mx-auto max-w-xl flex-1 px-6 py-20">
      <header className="text-center">
        <p className="text-[0.65rem] uppercase tracking-engraved text-gold">
          You are invited
        </p>
        <h1 className="mt-4 font-display text-4xl font-light leading-tight text-burgundy">
          {invite.partyName}
        </h1>
        <p className="mt-6 text-sm leading-relaxed text-ink-muted">
          to celebrate the {event.celebrant.age}th birthday of{" "}
          <span className="font-display text-base italic text-burgundy">
            {event.celebrant.fullName}
          </span>
        </p>
      </header>

      <dl className="mt-12 space-y-px overflow-hidden rounded-sm border border-hairline">
        <Row label="When">
          {event.date.displayDate}, {event.date.displayYear}
          <span className="block text-ink-muted">{event.date.displayTime}</span>
        </Row>
        <Row label="Where">
          {event.venue.name}
          <span className="block text-ink-muted">{event.venue.address}</span>
        </Row>
        <Row label="Attire">
          {attire.dressCode}
          <span className="mt-1 block text-ink-muted">{attire.guidance}</span>
        </Row>
        <Row label="Your table">
          {invite.table ? (
            <>
              {invite.table.name}
              {invite.table.locationNote && (
                <span className="block text-ink-muted">{invite.table.locationNote}</span>
              )}
            </>
          ) : (
            <span className="text-ink-muted">To be assigned closer to the date</span>
          )}
        </Row>
        <Row label="Seats">
          {invite.maxSeats} {invite.maxSeats === 1 ? "seat" : "seats"} reserved
        </Row>
      </dl>

      {courtRoles.length > 0 && (
        <section className="mt-10 rounded-sm border border-gold/40 bg-champagne/25 px-6 py-5 text-center">
          <p className="text-[0.65rem] uppercase tracking-engraved text-gold">
            A special role
          </p>
          {courtRoles.map((role) => (
            <p key={`${role.category}-${role.position}`} className="mt-3 text-sm text-burgundy">
              <span className="font-display text-lg italic">{role.guest}</span>
              <span className="mt-1 block">
                {ordinal(role.position)} of the {event.court[role.category].label}
              </span>
            </p>
          ))}
        </section>
      )}

      <RsvpForm
        code={invite.rsvpCode}
        maxSeats={invite.maxSeats}
        hasResponded={invite.respondedAt !== null}
        rsvpClosed={isRsvpClosed()}
        guests={invite.guests.map((guest) => ({
          id: guest.id,
          fullName: guest.fullName,
          rsvpStatus: guest.rsvpStatus,
          dietaryNotes: guest.dietaryNotes,
        }))}
        existingSongs={invite.songRequests}
      />
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-4 bg-ivory px-5 py-4 text-sm">
      <dt className="text-[0.65rem] uppercase tracking-engraved text-ink-muted">
        {label}
      </dt>
      <dd className="text-burgundy">{children}</dd>
    </div>
  );
}


function ordinal(n: number): string {
  const words = [
    "First", "Second", "Third", "Fourth", "Fifth", "Sixth",
    "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth",
    "Thirteenth", "Fourteenth", "Fifteenth", "Sixteenth", "Seventeenth", "Eighteenth",
  ];
  return words[n - 1] ?? `#${n}`;
}
