"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { event } from "@/content/event.config";
import { Countdown } from "@/components/Countdown";
import { HeroName } from "./HeroName";
import type { EventPhase } from "@/lib/phase";

/**
 * The obsidian hero.
 *
 * Typography-first: the photograph is atmosphere, not subject. It sits at low
 * opacity behind a gradient so the type always has a clean ground regardless of
 * how the image crops on a given viewport — a hero that only works at one aspect
 * ratio is a hero that breaks on half of real phones.
 *
 * The parallax is deliberately shallow (8% of scroll). Anything more reads as a
 * gimmick and costs more compositing on a cheap device.
 *
 * Motion is scoped: `useScroll` only tracks while the hero is on screen, and the
 * whole effect is skipped outright under `prefers-reduced-motion`.
 */

type Props = {
  phase: EventPhase;
  rsvpClosed: boolean;
  /** Cover image, already resolved through the Cloudinary loader. */
  cover: {
    src: string;
    loader?: (args: { src: string; width: number; quality?: number }) => string;
    unoptimized?: boolean;
  };
};

export function LuxuryHero({ phase, rsvpClosed, cover }: Props) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const imageY = useTransform(scrollYProgress, [0, 1], ["0%", "8%"]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section
      ref={ref}
      className="surface-obsidian relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-6 text-center"
    >
      <m.div
        className="absolute inset-0"
        style={reduced ? undefined : { y: imageY }}
        aria-hidden
      >
        <Image
          {...cover}
          alt=""
          fill
          priority
          sizes="100vw"
          className="scale-110 object-cover opacity-[0.28]"
        />
      </m.div>

      {/* Two washes: a vertical one so type never fights the image, and a soft
          gold bloom for warmth. Both are gradients, so they composite on the GPU. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-obsidian/70 via-obsidian/80 to-obsidian"
      />
      <div aria-hidden className="ambient-gold absolute inset-0 animate-[glow_8s_ease-in-out_infinite]" />

      <m.div
        className="relative z-10 flex flex-col items-center"
        style={reduced ? undefined : { opacity: fade }}
      >
        <m.p
          className="text-[0.6rem] uppercase tracking-editorial text-accent sm:text-xs"
          initial={reduced ? undefined : { opacity: 0, y: 12 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        >
          {event.date.displayDate} &middot; {event.date.displayYear}
        </m.p>

        <div className="mt-6">
          <HeroName name={event.celebrant.firstName} />
        </div>

        <m.div
          className="mt-6 flex items-center gap-5"
          initial={reduced ? undefined : { opacity: 0 }}
          animate={reduced ? undefined : { opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.9 }}
        >
          <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold/60" />
          <p className="font-display text-lg italic text-pearl/80 sm:text-xl">
            {event.celebrant.tagline}
          </p>
          <span className="h-px w-16 bg-gradient-to-l from-transparent to-gold/60" />
        </m.div>

        <m.div
          className="mt-12"
          initial={reduced ? undefined : { opacity: 0, y: 16 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.15, ease: [0.22, 1, 0.36, 1] }}
        >
          {phase !== "past" && <Countdown targetIso={event.date.iso} />}
        </m.div>

        <m.div
          className="mt-12 flex flex-col gap-3 sm:flex-row"
          initial={reduced ? undefined : { opacity: 0, y: 16 }}
          animate={reduced ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <PrimaryAction phase={phase} rsvpClosed={rsvpClosed} />
          <Link
            href="#program"
            className="rounded-full border border-gold/30 px-8 py-3 text-xs uppercase tracking-engraved text-pearl/80 transition hover:border-gold/60 hover:text-pearl"
          >
            Dress Code &amp; Programme
          </Link>
        </m.div>
      </m.div>

      <m.div
        aria-hidden
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
        initial={reduced ? undefined : { opacity: 0 }}
        animate={reduced ? undefined : { opacity: 1 }}
        transition={{ duration: 1, delay: 1.8 }}
      >
        <span className="block h-12 w-px bg-gradient-to-b from-gold/50 to-transparent" />
      </m.div>
    </section>
  );
}

/** The primary action changes with the moment — reply, then find your table, then look back. */
function PrimaryAction({ phase, rsvpClosed }: { phase: EventPhase; rsvpClosed: boolean }) {
  const base =
    "rounded-full bg-gold px-8 py-3 text-xs uppercase tracking-engraved text-obsidian transition hover:bg-champagne";

  if (phase === "past") {
    return (
      <Link href="#gallery" className={base}>
        View the photographs
      </Link>
    );
  }
  if (phase === "event-day") {
    return (
      <Link href="/live" className={base}>
        Tonight&apos;s programme
      </Link>
    );
  }
  if (rsvpClosed) {
    return (
      <span className="rounded-full border border-pearl/20 px-8 py-3 text-xs uppercase tracking-engraved text-pearl/50">
        Replies are closed
      </span>
    );
  }
  return (
    <Link href="/rsvp" className={base}>
      Confirm RSVP
    </Link>
  );
}
