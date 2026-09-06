"use client";

import { useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { event, type CourtCategory } from "@/content/event.config";
import type { CourtEntry } from "@/db/queries";
import { cn } from "@/lib/utils";

/**
 * The evening, as an expandable timeline.
 *
 * Segments tied to an 18s group open to reveal the actual eighteen — tapping
 * "The 18 Roses" answers "who is in it?" without leaving the page. Segments with
 * no roster are inert and say so by not offering a control at all, rather than
 * expanding to an empty panel.
 *
 * Built as buttons with `aria-expanded`/`aria-controls`, so it is a real
 * disclosure widget and works from the keyboard. `AnimatePresence` handles the
 * height transition; under reduced motion the CSS in globals.css collapses the
 * duration, so the panel simply appears.
 *
 * The roster is passed down from the server — it is a public list of names, and
 * shipping it with the page means opening a segment costs no round trip on venue
 * wifi.
 */

type Props = {
  court: Partial<Record<CourtCategory, CourtEntry[]>>;
};

export function ProgramTimeline({ court }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ol className="mt-12 border-t border-hairline">
      {event.program.map((item) => {
        const roster = item.courtCategory ? (court[item.courtCategory] ?? []) : [];
        const expandable = roster.length > 0;
        const isOpen = open === item.title;

        return (
          <li key={item.title} className="border-b border-hairline">
            <TimelineRow
              item={item}
              expandable={expandable}
              isOpen={isOpen}
              onToggle={() => setOpen(isOpen ? null : item.title)}
            />

            <AnimatePresence initial={false}>
              {expandable && isOpen && (
                <m.div
                  id={`segment-${slug(item.title)}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pb-6 pl-[5.5rem] pr-2">
                    {item.courtCategory && (
                      <p className="text-xs italic text-muted">
                        {event.court[item.courtCategory].blurb}
                      </p>
                    )}
                    <ol className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                      {roster.map((entry) => (
                        <li
                          key={entry.position}
                          className="grid grid-cols-[1.75rem_1fr] items-baseline text-sm"
                        >
                          <span className="text-[0.7rem] tabular-nums text-accent">
                            {String(entry.position).padStart(2, "0")}
                          </span>
                          <span className="text-foreground">{entry.displayName}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ol>
  );
}

function TimelineRow({
  item,
  expandable,
  isOpen,
  onToggle,
}: {
  item: (typeof event.program)[number];
  expandable: boolean;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const content = (
    <>
      <span className="pt-1 text-[0.65rem] uppercase tracking-engraved tabular-nums text-accent">
        {item.time}
      </span>
      <span>
        <span className="font-display text-xl text-foreground">{item.title}</span>
        {item.detail && <span className="mt-1 block text-sm text-muted">{item.detail}</span>}
      </span>
      {expandable && (
        <span
          aria-hidden
          className={cn(
            "pt-2 text-accent transition-transform duration-300",
            isOpen && "rotate-45",
          )}
        >
          +
        </span>
      )}
    </>
  );

  const layout = "grid w-full grid-cols-[5.5rem_1fr_1.5rem] gap-4 py-5 text-left";

  // A segment with nothing to reveal is not a control. Rendering it as a button
  // would promise an interaction that does not exist.
  if (!expandable) {
    return <div className={cn(layout, "cursor-default")}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={`segment-${slug(item.title)}`}
      className={cn(layout, "group transition hover:opacity-80")}
    >
      {content}
    </button>
  );
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
