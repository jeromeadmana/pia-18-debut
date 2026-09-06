import Image from "next/image";
import Link from "next/link";
import { event } from "@/content/event.config";
import { Countdown } from "@/components/Countdown";
import { resolveImage } from "@/lib/cloudinary";
import { Guestbook } from "@/components/Guestbook";

/**
 * Home page — fully static.
 *
 * Everything here comes from `event.config.ts`, so this page is prerendered at
 * build time and costs zero serverless invocations no matter how many guests
 * open the link. That is the single biggest lever for staying inside Vercel
 * Hobby limits on the night.
 *
 * The guestbook is the one live element here. It fetches on the client, which
 * is what lets this page stay fully prerendered while the wishes wall stays
 * current.
 */

export default function HomePage() {
  return (
    <main className="flex-1">
      <Hero />
      <Program />
      <Details />
      <CourtTeaser />
      <Gallery />
      <Gifts />
      <Guestbook />
    </main>
  );
}

function Hero() {
  const cover = resolveImage(event.gallery[0]);

  return (
    <section className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center">
      <Image
        {...cover}
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover opacity-20"
      />
      {/* Wash the photo back so the type stays legible over any crop. */}
      <div className="absolute inset-0 bg-gradient-to-b from-ivory/80 via-ivory/60 to-ivory" />

      <div className="relative z-10 flex flex-col items-center gap-8">
        <p className="text-xs uppercase tracking-engraved text-ink-muted">
          {event.date.displayDate} &middot; {event.date.displayYear}
        </p>

        <h1 className="font-display text-6xl font-light leading-none text-burgundy sm:text-8xl">
          {event.celebrant.firstName}
        </h1>

        <div className="flex items-center gap-4">
          <span className="h-px w-12 bg-gold/40" />
          <p className="font-display text-lg italic text-ink-muted">
            {event.celebrant.tagline}
          </p>
          <span className="h-px w-12 bg-gold/40" />
        </div>

        <Countdown targetIso={event.date.iso} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/rsvp"
            className="rounded-full bg-burgundy px-8 py-3 text-sm uppercase tracking-engraved text-ivory transition hover:bg-ink"
          >
            Confirm RSVP
          </Link>
          <Link
            href="#program"
            className="rounded-full border border-gold/50 px-8 py-3 text-sm uppercase tracking-engraved text-burgundy transition hover:bg-champagne/40"
          >
            Dress Code &amp; Program
          </Link>
        </div>
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
            <span className="pt-1 text-xs uppercase tracking-engraved text-gold tabular-nums">
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
          <p className="mt-6 font-display text-2xl text-burgundy">{event.venue.name}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-muted">{event.venue.address}</p>
          <p className="mt-4 text-sm text-ink-muted">{event.venue.parkingNote}</p>

          <div className="mt-6 flex gap-3">
            <a
              href={event.venue.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-gold/50 px-5 py-2 text-xs uppercase tracking-engraved text-burgundy transition hover:bg-champagne/50"
            >
              Open in Maps
            </a>
            {event.venue.wazeUrl && (
              <a
                href={event.venue.wazeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-gold/50 px-5 py-2 text-xs uppercase tracking-engraved text-burgundy transition hover:bg-champagne/50"
              >
                Waze
              </a>
            )}
          </div>
        </div>

        <div>
          <SectionHeading eyebrow="What to Wear" title={event.attire.dressCode} align="left" />
          <p className="mt-6 text-sm leading-relaxed text-ink-muted">
            {event.attire.guidance}
          </p>

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
        className="mt-8 inline-block rounded-full border border-gold/50 px-8 py-3 text-sm uppercase tracking-engraved text-burgundy transition hover:bg-champagne/40"
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
    <section className="mx-auto max-w-5xl px-6 py-24">
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
      <p className="text-[0.65rem] uppercase tracking-engraved text-gold">{eyebrow}</p>
      <h2 className="mt-3 font-display text-4xl font-light text-burgundy">{title}</h2>
    </header>
  );
}
