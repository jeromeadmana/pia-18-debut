"use client";

import { useSyncExternalStore } from "react";
import { currentProgramIndex, type ProgramInstant } from "@/lib/phase";

/**
 * The event-day programme, with "now" marked.
 *
 * Written for the actual conditions: a guest standing in a dim ballroom, on
 * congested venue wifi, glancing at a phone. So:
 *
 *  - The current item is the visual anchor — larger, filled, unmissable.
 *  - Past items stay visible but recede; guests arriving late want to know what
 *    they missed, not have it hidden.
 *  - It ticks on a 30s clock, not 1s. Nothing here changes second to second, and
 *    a slower interval is kinder to a battery at the end of a long evening.
 *  - No network calls after load. The programme is static data handed down from
 *    the server, so this keeps working if the wifi drops.
 */

const TICK_MS = 30_000;

const clock = (() => {
  let snapshot = Date.now();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      timer ??= setInterval(() => {
        snapshot = Date.now();
        for (const listener of listeners) listener();
      }, TICK_MS);

      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0 && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => null,
  };
})();

export function LiveProgramme({ program }: { program: ProgramInstant[] }) {
  const now = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot,
  );

  // Before hydration `now` is null, so nothing is highlighted — the list still
  // renders in full from the server HTML.
  const currentIndex = now === null ? -1 : currentProgramIndex(program, now);

  return (
    <ol className="mt-10 space-y-2">
      {program.map((item, index) => {
        const isCurrent = index === currentIndex;
        const isPast = currentIndex >= 0 && index < currentIndex;

        return (
          <li
            key={item.title}
            aria-current={isCurrent ? "step" : undefined}
            className={`rounded-sm border px-5 py-4 transition ${
              isCurrent
                ? "border-gold bg-champagne/40"
                : isPast
                  ? "border-hairline bg-ivory opacity-50"
                  : "border-hairline bg-ivory"
            }`}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span
                className={`tabular-nums ${
                  isCurrent
                    ? "text-xs uppercase tracking-engraved text-gold"
                    : "text-xs uppercase tracking-engraved text-ink-muted"
                }`}
              >
                {item.time}
              </span>
              {isCurrent && (
                <span className="rounded-full bg-burgundy px-3 py-0.5 text-[0.6rem] uppercase tracking-engraved text-ivory">
                  Now
                </span>
              )}
            </div>

            <p
              className={`mt-1 font-display text-burgundy ${
                isCurrent ? "text-2xl" : "text-lg"
              }`}
            >
              {item.title}
            </p>
            {item.detail && (
              <p className="mt-1 text-sm text-ink-muted">{item.detail}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
