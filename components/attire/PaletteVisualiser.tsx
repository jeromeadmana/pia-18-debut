"use client";

import { useState } from "react";
import { event } from "@/content/event.config";
import { cn } from "@/lib/utils";

/**
 * The dress-code palette, as something you can actually judge.
 *
 * A row of colour chips tells a guest almost nothing — the real questions are
 * "what does this look like as a garment?" and "will I disappear against it?".
 * So selecting a swatch shows it as a large field with both light and dark text
 * over it, and states the measured contrast.
 *
 * The luminance maths is the same WCAG formula used to pick this site's own
 * accent colour, which is why the advice is a computed fact rather than a guess.
 */

type Swatch = { name: string; hex: string };

/** Relative luminance, per WCAG 2.1. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function PaletteVisualiser() {
  const [selected, setSelected] = useState<Swatch>(event.attire.palette[1]);

  const againstDark = contrast(selected.hex, "#0b0b0b");
  const againstLight = contrast(selected.hex, "#fdfbf7");
  const prefersDarkPairing = againstLight > againstDark;

  return (
    <div>
      <div
        role="radiogroup"
        aria-label="Palette colours"
        className="flex flex-wrap gap-3"
      >
        {event.attire.palette.map((swatch) => {
          const active = swatch.hex === selected.hex;
          return (
            <button
              key={swatch.name}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(swatch)}
              className="group flex flex-col items-center gap-2"
            >
              <span
                className={cn(
                  "block h-12 w-12 rounded-full ring-1 ring-inset ring-black/10 transition",
                  active
                    ? "scale-110 shadow-[0_0_0_2px_var(--background),0_0_0_3px_var(--accent)]"
                    : "group-hover:scale-105",
                )}
                style={{ backgroundColor: swatch.hex }}
              />
              <span
                className={cn(
                  "text-[0.6rem] uppercase tracking-wide transition",
                  active ? "text-foreground" : "text-muted",
                )}
              >
                {swatch.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* The swatch as a field, with type over it, so the guest can see how it
          actually behaves rather than reading a hex value. */}
      <div
        className="mt-6 overflow-hidden rounded-sm border border-hairline"
        style={{ backgroundColor: selected.hex }}
      >
        <div className="flex flex-col gap-1 px-6 py-8 text-center">
          <span className="font-display text-2xl" style={{ color: "#0b0b0b" }}>
            {selected.name}
          </span>
          <span className="font-display text-2xl italic" style={{ color: "#fdfbf7" }}>
            {selected.name}
          </span>
        </div>
      </div>

      <p aria-live="polite" className="mt-3 text-xs leading-relaxed text-muted">
        <span className="text-foreground">{selected.name}</span> pairs best with{" "}
        <span className="text-foreground">
          {prefersDarkPairing ? "dark" : "light"} accessories
        </span>{" "}
        — {Math.max(againstDark, againstLight).toFixed(1)}:1 against{" "}
        {prefersDarkPairing ? "obsidian" : "ivory"}, versus{" "}
        {Math.min(againstDark, againstLight).toFixed(1)}:1 the other way.
      </p>

      <div className="mt-8 border-t border-hairline pt-6">
        <p className="text-[0.6rem] uppercase tracking-engraved text-accent">
          Kindly avoid
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {event.attire.avoid.map((swatch) => (
            <span key={swatch.name} className="flex items-center gap-2">
              <span
                aria-hidden
                className="relative block h-7 w-7 rounded-full ring-1 ring-inset ring-black/15"
                style={{ backgroundColor: swatch.hex }}
              >
                {/* A diagonal bar reads as "no" without needing a label. */}
                <span className="absolute left-1/2 top-1/2 h-px w-9 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-rose" />
              </span>
              <span className="text-xs text-muted">{swatch.name}</span>
            </span>
          ))}
          <span className="text-xs italic text-muted">
            — these read as competing with the debutante in photographs.
          </span>
        </div>
      </div>
    </div>
  );
}
