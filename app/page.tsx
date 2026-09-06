import Image from "next/image";
import Link from "next/link";
import { event } from "@/content/event.config";
import { resolveImage } from "@/lib/cloudinary";
import { Guestbook } from "@/components/Guestbook";
import { LuxuryHero } from "@/components/hero/LuxuryHero";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { getEventPhase, isRsvpClosed } from "@/lib/phase";
import { hasVenueMap, venueAddress, venueName } from "@/lib/content";

/**
 * Home page — fully static.
 *
 * Everything here comes from `event.config.ts`, so this page is prerendered at
 * build time and costs zero serverless invocations no matter how many guests
 * open the link. That is the single biggest lever for staying inside Vercel
 * Hobby limits on the night.
 *
 * The guestbook is the one live element here. It fetches on the client, which
 * is what lets this page stay prerendered while the wishes wall stays current.
 *
 * Revalidating every 15 minutes rather than building once: the page reads the
 * event phase, so a purely static render would still be advertising "confirm
 * your RSVP" during the party. Four renders an hour is a rounding error against
 * the Hobby budget and buys correctness at every phase boundary.
 */
export const revalidate = 900;

export default function HomePage() {
  const phase = getEventPhase();
  const rsvpClosed = isRsvpClosed();

  return (
    <main className="flex-1">
      {phase === "event-day" && <TonightBanner />}

      {/* MotionProvider is scoped to the hero rather than placed in the root
          layout: /live must stay motion-free, and a layout-level provider would
          ship the animation bundle to it. */}
      <MotionProvider>
        <LuxuryHero
          phase={phase}
          rsvpClosed={rsvpClosed}
          cover={resolveImage(event.gallery[0])}
        />
      </MotionProvider>
      {phase === "past" && <ThankYou />}
      <Program />
      <Details />
      <CourtTeaser />
      <Gallery />
      <Gifts />
      <Guestbook />
    </main>
  );
}

function TonightBanner() {
  return (
    <div className="bg-burgundy px-6 py-3 text-center">
      <Link
        href="/live"
        className="text-xs uppercase tracking-engraved text-ivory underline-offset-4 hover:underline"
      >
        Tonight&apos;s programme &amp; your table &rarr;
      </Link>
    </div>
  );
}

function ThankYou() {
  return (
    <section className="border-y border-hairline bg-champagne/25 px-6 py-20 text-center">
      <div className="mx-auto max-w-xl">
        <p className="text-[0.65rem] uppercase tracking-engraved text-accent">
          With love
        </p>
        <h2 className="mt-3 font-display text-4xl font-light text-burgundy">
          Thank you for being there
        </h2>
        <p className="mt-6 text-sm leading-relaxed text-ink-muted">
          Thank you for celebrating {event.celebrant.firstName}&apos;s eighteenth
          with her. The photographs and every wish left here are hers to keep.
        </p>
      </div>
    </section>
  );
}

function Program() {
  return (
    <section id="program" className="mx-auto max-w-2xl px-6 py-24">
      <SectionHeading eyebrow="The Evening" title="Programme" />

      <ol className="mt-12">
        {event.program.map((item) => (
          <li
            key={item.title}
            className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-hairline py-5 last:border-0"
          >
            <span className="pt-1 text-xs uppercase tracking-engraved text-accent tabular-nums">
              {item.time}
            </span>
            <span>
              <span className="font-display text-xl text-burgundy">{item.title}</span>
              {item.detail && (
                <span className="mt-1 block text-sm text-ink-muted">{item.detail}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Details() {
  return (
    <section className="border-y border-hairline bg-champagne/20 px-6 py-24">
      <div className="mx-auto grid max-w-4xl gap-16 sm:grid-cols-2">
        <div>
          <SectionHeading eyebrow="Where" title="The Venue" align="left" />
          <p className="mt-6 font-display text-2xl text-burgundy">{venueName()}</p>
          {venueAddress() && (
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{venueAddress()}</p>
          )}
          <p className="mt-4 text-sm text-ink-muted">{event.venue.parkingNote}</p>

          <div className="mt-6 flex gap-3">
            {hasVenueMap() && (
              <a
                href={event.venue.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-accent/50 px-5 py-2 text-xs uppercase tracking-engraved text-burgundy transition hover:bg-champagne/50"
              >
                Open in Maps
              </a>
            )}
            {event.venue.wazeUrl && (
              <a
                href={event.venue.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-accent/50 px-5 py-2 text-xs uppercase tracking-engraved text-burgundy transition hover:bg-champagne/50"
              >
                Waze
              </a>
            )}
          </div>
        </div>

        <div>
          <SectionHeading eyebrow="What to Wear" title="Attire" align="left" />

          {/* Guests first, deliberately. Most people reading this are not in the
              entourage, and the headline for them is "relax". */}
          <div className="mt-6">
            <p className="font-display text-xl text-burgundy">
              {event.attire.guests.dressCode}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {event.attire.guests.guidance}
            </p>
          </div>

          <div className="mt-6 border-t border-hairline pt-6">
            <p className="text-[0.65rem] uppercase tracking-engraved text-accent">
              For the entourage
            </p>
            <p className="mt-2 font-display text-xl text-burgundy">
              {event.attire.entourage.dressCode}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">
              {event.attire.entourage.guidance}
            </p>
          </div>

          <ul className="mt-8 flex flex-wrap gap-4">
            {event.attire.palette.map((swatch) => (
              <li key={swatch.name} className="flex flex-col items-center gap-2">
                <span
                  className="block h-12 w-12 rounded-full ring-1 ring-inset ring-black/10"
                  style={{ backgroundColor: swatch.hex }}
                />
                <span className="text-[0.6rem] uppercase tracking-wide text-ink-muted">
                  {swatch.name}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function CourtTeaser() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-24 text-center">
      <SectionHeading eyebrow="Her Court" title="The Eighteens" />
      <p className="mt-6 text-sm leading-relaxed text-ink-muted">
        Eighteen roses, eighteen candles, eighteen treasures — the people who have
        shaped {event.celebrant.firstName}&apos;s first eighteen years.
      </p>
      <Link
        href="/court"
        className="mt-8 inline-block rounded-full border border-accent/50 px-8 py-3 text-sm uppercase tracking-engraved text-burgundy transition hover:bg-champagne/40"
      >
        See the court
      </Link>
    </section>
  );
}

function Gifts() {
  return (
    <section className="mx-auto max-w-xl px-6 py-24 text-center">
      <SectionHeading eyebrow="Gifts" title={event.gifts.heading} />
      <p className="mt-6 text-sm leading-relaxed text-ink-muted">{event.gifts.body}</p>
    </section>
  );
}

function Gallery() {
  return (
    <section id="gallery" className="mx-auto max-w-5xl px-6 py-24">
      <SectionHeading eyebrow="Pre-Debut" title="The Photoshoot" />

      <div className="mt-12 columns-2 gap-4 sm:columns-3 [&>*]:mb-4">
        {event.gallery.map((entry) => {
          const image = resolveImage(entry);
          return (
            <Image
              key={entry.src}
              {...image}
              alt={entry.alt}
              width={entry.width}
              height={entry.height}
              sizes="(max-width: 640px) 50vw, 33vw"
              className="w-full rounded-sm"
            />
          );
        })}
      </div>
    </section>
  );
}

function SectionHeading({
  eyebrow,
  title,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  align?: "center" | "left";
}) {
  return (
    <header className={align === "center" ? "text-center" : "text-left"}>
      <p className="text-[0.65rem] uppercase tracking-engraved text-accent">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-light text-burgundy">{title}</h2>
    </header>
  );
}
