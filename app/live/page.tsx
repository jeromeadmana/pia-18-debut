import Link from "next/link";
import { event } from "@/content/event.config";
import { programWithInstants } from "@/lib/phase";
import { LiveProgramme } from "@/components/LiveProgramme";
import { SiteHeader } from "@/components/SiteHeader";
import { hasVenueMap, venueName } from "@/lib/content";

/**
 * Event-day view — the page a guest opens while standing in the venue.
 *
 * Statically prerendered. The programme is fixed data, and "what is happening
 * now" is computed in the browser, so on the night this page costs zero
 * serverless invocations and zero database reads no matter how many phones open
 * it at once. That is the whole point: this is the one page guaranteed to see a
 * traffic spike, and it is the one page that touches nothing.
 *
 * Guests reach their table number through their own invite link, which is
 * deliberately not duplicated here — this page is public and must stay free of
 * anything guest-specific.
 */
export const metadata = {
  title: "Tonight",
  robots: { index: false, follow: false },
};

export default function LivePage() {
  const program = programWithInstants();

  return (
    <>
      <SiteHeader current="live" />

      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
        <header className="text-center">
          <p className="text-[0.65rem] uppercase tracking-engraved text-gold">Tonight</p>
          <h1 className="mt-3 font-display text-4xl font-light text-burgundy">
            {event.celebrant.firstName}&apos;s Debut
          </h1>
          <p className="mt-3 text-sm text-ink-muted">{venueName()}</p>
        </header>

        <LiveProgramme program={program} />

        <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/rsvp"
            className="rounded-full border border-gold/50 px-6 py-3 text-center text-xs uppercase tracking-engraved text-burgundy transition hover:bg-champagne/40"
          >
            Find your table
          </Link>
          <Link
            href="/court"
            className="rounded-full border border-gold/50 px-6 py-3 text-center text-xs uppercase tracking-engraved text-burgundy transition hover:bg-champagne/40"
          >
            The eighteens
          </Link>
          {hasVenueMap() && (
            <a
              href={event.venue.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-gold/50 px-6 py-3 text-center text-xs uppercase tracking-engraved text-burgundy transition hover:bg-champagne/40"
            >
              Directions
            </a>
          )}
        </div>
      </main>
    </>
  );
}
