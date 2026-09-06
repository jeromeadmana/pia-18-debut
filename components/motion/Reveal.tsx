"use client";

import { m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Entrance reveal — content rises and fades as it enters the viewport.
 *
 * Two things it gets right that a naive version does not:
 *
 *  - **`whileInView` with `once`**, so the observer detaches after firing. A
 *    reveal that replays on every scroll-past is a distraction, and keeping
 *    observers alive on a long page costs real work on a cheap phone.
 *  - **Honours `prefers-reduced-motion`** by rendering the final state directly
 *    rather than animating to it. The CSS in globals.css collapses transition
 *    durations, but Framer writes inline styles, so a component that starts at
 *    `opacity: 0` would otherwise be stuck invisible for those users. That is
 *    the failure mode worth guarding against — reduced motion must never mean
 *    reduced content.
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({
  children,
  delay = 0,
  y = 20,
  className,
}: {
  children: ReactNode;
  delay?: number;
  /** Distance to travel, in px. Set 0 for a pure fade. */
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: 0.9, delay, ease: EASE }}
    >
      {children}
    </m.div>
  );
}

/**
 * Staggered children. Wrap a list; each direct `<RevealItem>` follows the last.
 *
 * Stagger is what separates a considered entrance from everything appearing at
 * once — but it compounds, so keep `stagger` small and the child count modest.
 */
export function RevealGroup({
  children,
  stagger = 0.08,
  delay = 0,
  className,
}: {
  children: ReactNode;
  stagger?: number;
  delay?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: "-10% 0px" }}
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </m.div>
  );
}

export function RevealItem({
  children,
  y = 16,
  className,
}: {
  children: ReactNode;
  y?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <m.div
      className={cn(className)}
      variants={{
        hidden: { opacity: 0, y },
        shown: { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
      }}
    >
      {children}
    </m.div>
  );
}
