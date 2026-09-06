import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { getInviteByCode } from "@/db/queries";
import { event } from "@/content/event.config";
import { venueName } from "@/lib/content";
import { SiteHeader } from "@/components/SiteHeader";
import { PrintButton } from "@/components/pass/PrintButton";

/**
 * The digital guest pass.
 *
 * A saveable card carrying the party name, table, seat count and a QR code, so
 * door staff can scan a phone instead of hunting a printed list.
 *
 * Two deliberate choices:
 *
 * 1. **The QR is generated on the server as an inline SVG.** No QR library
 *    reaches the browser, the code is in the initial HTML, and it stays crisp at
 *    any size — which matters when someone screenshots it or a scanner meets a
 *    dim ballroom and a cracked screen protector.
 *
 * 2. **It encodes the guest's own invite URL**, not a bare id. If the scanner is
 *    just a phone camera — which at a family debut it will be — it opens the
 *    invitation and shows the party, table and role. No dedicated scanner app
 *    has to exist for this to be useful.
 *
 * Print styles live in globals.css so a guest can also put it on paper.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Guest pass",
  robots: { index: false, follow: false },
};

export default async function PassPage({ params }: PageProps<"/i/[code]/pass">) {
  const { code } = await params;
  const invite = await getInviteByCode(code);
  if (!invite) notFound();

  const attending = invite.guests.filter((g) => g.rsvpStatus === "attending");
  const roles = invite.guests.flatMap((g) => g.courtRoles);

  // Absolute URL so the QR works when scanned from a phone camera. Falls back to
  // a relative path only if no origin is configured, which still resolves for
  // anyone scanning from the same device.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const qrSvg = await QRCode.toString(`${origin}/i/${invite.rsvpCode}`, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#0b0b0b", light: "#00000000" },
  });

  return (
    <>
      <div className="print:hidden">
        <SiteHeader />
      </div>

      <main className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <article className="surface-obsidian ambient-gold overflow-hidden rounded-lg border border-gold/30 print:border-black">
          <header className="border-b border-gold/20 px-8 pt-10 text-center">
            <p className="text-[0.55rem] uppercase tracking-editorial text-accent">
              {event.date.displayDate} &middot; {event.date.displayYear}
            </p>
            <h1 className="mt-4 font-display text-5xl font-extralight text-foreground">
              {event.celebrant.firstName}
            </h1>
            <p className="mt-1 font-display text-base italic text-muted">
              {event.celebrant.tagline}
            </p>
            <p className="mb-8 mt-4 text-[0.6rem] uppercase tracking-engraved text-muted">
              Admit {invite.maxSeats} {invite.maxSeats === 1 ? "guest" : "guests"}
            </p>
          </header>

          <div className="px-8 py-8">
            <Row label="Guest">{invite.partyName}</Row>
            <Row label="Table">
              {invite.table ? invite.table.name : "To be assigned"}
            </Row>
            <Row label="Venue">{venueName()}</Row>
            <Row label="Doors">{event.date.callTime}</Row>
            {roles.length > 0 && (
              <Row label="Role">
                {roles
                  .map((r) => `${event.court[r.category].label} · ${r.position}`)
                  .join(", ")}
              </Row>
            )}

            <div className="mt-8 flex flex-col items-center border-t border-gold/20 pt-8">
              {/* Rendered on a pale plate so it scans on the dark card and in print. */}
              <div
                className="w-40 rounded-sm bg-pearl p-3 [&>svg]:h-full [&>svg]:w-full"
                aria-hidden
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <p className="mt-4 font-mono text-xs tracking-widest text-muted">
                {invite.rsvpCode}
              </p>
              <p className="mt-1 text-[0.55rem] uppercase tracking-editorial text-muted">
                Present at the door
              </p>
            </div>
          </div>
        </article>

        {attending.length === 0 && (
          <p className="mt-6 text-center text-xs leading-relaxed text-muted print:hidden">
            No one on this invitation is marked attending yet. The pass will still
            scan, but{" "}
            <Link href={`/i/${invite.rsvpCode}`} className="text-accent underline">
              confirming your reply
            </Link>{" "}
            helps with seating.
          </p>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row print:hidden">
          <div className="flex-1">
            <PrintButton />
          </div>
          <Link
            href={`/i/${invite.rsvpCode}`}
            className="min-h-12 flex-1 rounded-full border border-hairline px-6 py-3 text-center text-xs uppercase tracking-engraved text-muted transition hover:text-foreground"
          >
            Back to invitation
          </Link>
        </div>
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_1fr] gap-4 border-b border-gold/10 py-3 text-sm last:border-0">
      <dt className="text-[0.55rem] uppercase tracking-editorial text-muted">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}

