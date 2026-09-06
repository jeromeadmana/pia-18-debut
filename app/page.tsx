import Image from "next/image";
import Link from "next/link";
import { event } from "@/content/event.config";
import { resolveImage } from "@/lib/cloudinary";
import { Guestbook } from "@/components/Guestbook";
import { LuxuryHero } from "@/components/hero/LuxuryHero";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { getEventPhase, isRsvpClosed } from "@/lib/phase";
import { listCourtTolerant } from "@/db/queries";
import { ProgramTimeline } from "@/components/program/ProgramTimeline";
import { PaletteVisualiser } from "@/components/attire/PaletteVisualiser";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
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

export default async function HomePage() {
  const phase = getEventPhase();
  const rsvpClosed = isRsvpClosed();

  // The roster is public and small, and this page is ISR — one render every 15
  // minutes serves every guest, so the programme can list the eighteens without
  // a per-visitor query. Tolerant of a sleeping database (see the helper).
  const court = await listCourtTolerant();

  return (
    <main className="flex-1">
      {phase === "event-day" && <TonightBanner />}

      {/* One MotionProvider for the page, not the root layout: /live must stay
          motion-free, and a layout-level provider would ship the bundle to it. */}
      <MotionProvider>
        <LuxuryHero
          phase={phase}
          rsvpClosed={rsvpClosed}
          cover={resolveImage(event.gallery[0])}
        />
        {phase === "past" && <ThankYou />}
        <Program court={court} />
        <Details />
        <CourtTeaser />
        <Gallery />
        <Gifts />
        <Guestbook />
      </MotionProvider>
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
        <h2 className="mt-3 font-display text-4xl font-extralight tracking-tight text-foreground">
          Thank you for being there
        </h2>
        <p className="mt-6 text-sm leading-relaxed text-muted">
          Thank you for celebrating {event.celebrant.firstName}&apos;s eighteenth
          with her. The photographs and every wish left here are hers to keep.
        </p>
      </div>
    </section>
  );
}

function Program({ court }: { court: Awaited<ReturnType<typeof listCourtTolerant>> }) {
  return (
    <section id="program" className="surface-ivory px-6 py-28">
      <div className="mx-auto max-w-2xl">
        <Reveal>
          <SectionHeading eyebrow="The Evening" title="Programme" />
          <p className="mt-4 text-center text-xs text-muted">
            Tap a segment marked + to see who takes part.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <ProgramTimeline court={court} />
        </Reveal>
      </div>
    </section>
  );
}

function Details() {
  return (
    <section className="surface-obsidian ambient-gold px-6 py-28">
      <div className="mx-auto grid max-w-5xl gap-16 sm:grid-cols-2">
        <Reveal>
          <SectionHeading eyebrow="Where" title="The Venue" align="left" />
          <p className="mt-6 font-display text-3xl font-light text-foreground">
            {venueName()}
          </p>
          {venueAddress() && (
            <p className="mt-2 text-sm leading-relaxed text-muted">{venueAddress()}</p>
          )}
          <p className="mt-4 text-sm text-muted">{event.venue.parkingNote}</p>

          <div className="mt-8 flex gap-3">
            {hasVenueMap() && (
              <a
                href={event.venue.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gold/40 px-5 py-2 text-[0.65rem] uppercase tracking-engraved text-foreground transition hover:border-gold"
              >
                Open in Maps
              </a>
            )}
            {event.venue.wazeUrl && (
              <a
                href={event.venue.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gold/40 px-5 py-2 text-[0.65rem] uppercase tracking-engraved text-foreground transition hover:border-gold"
              >
                Waze
              </a>
            )}
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <SectionHeading eyebrow="What to Wear" title="Attire" align="left" />

          {/* Guests first: most readers are not in the entourage, and their
              headline is "relax". */}
          <div className="mt-6">
            <p className="font-display text-2xl text-foreground">
              {event.attire.guests.dressCode}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {event.attire.guests.guidance}
            </p>
          </div>

          <div className="mt-6 border-t border-hairline pt-6">
            <p className="text-[0.6rem] uppercase tracking-engraved text-accent">
              For the entourage
            </p>
            <p className="mt-2 font-display text-2xl text-foreground">
              {event.attire.entourage.dressCode}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {event.attire.entourage.guidance}
            </p>
          </div>

          <div className="mt-8">
            <PaletteVisualiser />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function CourtTeaser() {
  return (
    <section className="surface-ivory px-6 py-28 text-center">
      <div className="mx-auto max-w-2xl">
      <SectionHeading eyebrow="Her Court" title="The Eighteens" />
      <p className="mt-6 text-sm leading-relaxed text-muted">
        Eighteen roses, eighteen candles, eighteen treasures — the people who have
        shaped {event.celebrant.firstName}&apos;s first eighteen years.
      </p>
      <Link
        href="/court"
        className="mt-8 inline-block rounded-full border border-accent/50 px-8 py-3 text-sm uppercase tracking-engraved text-burgundy transition hover:bg-champagne/40"
      >
        See the court
      </Link>
      </div>
    </section>
  );
}

function Gifts() {
  return (
    <section className="surface-obsidian px-6 py-28 text-center">
      <div className="mx-auto max-w-xl">
        <SectionHeading eyebrow="Gifts" title={event.gifts.heading} />
        <p className="mt-6 text-sm leading-relaxed text-muted">{event.gifts.body}</p>
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <section id="gallery" className="surface-ivory px-6 py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow="Pre-Debut" title="The Photoshoot" />
        </Reveal>

        {/* Staggered so the grid assembles rather than snapping in at once. */}
        <RevealGroup
          stagger={0.06}
          className="mt-12 columns-2 gap-4 sm:columns-3 [&>*]:mb-4"
        >
          {event.gallery.map((entry) => {
            const image = resolveImage(entry);
            return (
              <RevealItem key={entry.src}>
                <Image
                  {...image}
                  alt={entry.alt}
                  width={entry.width}
                  height={entry.height}
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="w-full rounded-sm"
                />
              </RevealItem>
            );
          })}
        </RevealGroup>
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
      <p className="text-[0.6rem] uppercase tracking-editorial text-accent">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-extralight tracking-tight text-foreground">{title}</h2>
    </header>
  );
}
