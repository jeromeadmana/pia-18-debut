"use client";

import { m, useReducedMotion } from "framer-motion";

/**
 * The celebrant's name, revealed letter by letter.
 *
 * **Accessibility first.** Splitting a word into per-letter elements destroys it
 * for screen readers — "P, I, A" instead of "Pia". So the real name is rendered
 * once in an `<h1>` for assistive tech, and the animated letters are a separate
 * `aria-hidden` layer. The two are never both announced.
 *
 * Each letter rises behind a `overflow-hidden` mask rather than merely fading,
 * which is what makes it read as typesetting rather than a generic fade-in.
 *
 * A space gets an explicit non-breaking character — an empty inline-block would
 * collapse and close the word up.
 */
export function HeroName({ name }: { name: string }) {
  const reduced = useReducedMotion();
  const letters = [...name];

  return (
    <h1 className="font-display text-[clamp(4rem,18vw,11rem)] font-extralight text-foreground">
      <span className="sr-only">{name}</span>

      {reduced ? (
        <span aria-hidden>{name}</span>
      ) : (
        <span aria-hidden className="flex justify-center">
          {letters.map((letter, i) => (
            <span key={i} className="inline-block overflow-hidden">
              <m.span
                className="inline-block"
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                transition={{
                  duration: 1,
                  // Slight overlap between letters so the word arrives as a
                  // phrase rather than a typewriter.
                  delay: 0.25 + i * 0.07,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {letter === " " ? " " : letter}
              </m.span>
            </span>
          ))}
        </span>
      )}
    </h1>
  );
}
