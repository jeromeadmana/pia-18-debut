"use client";

import { useSyncExternalStore } from "react";

/**
 * Countdown to the debut.
 *
 * Runs entirely in the browser — it never costs a serverless invocation, which
 * matters because this is the one element on the page that wants to update every
 * second.
 *
 * Uses the semantic colour tokens, so it reads correctly on the obsidian hero
 * and on any ivory section it might later be reused in.
 *
 * Built on `useSyncExternalStore` rather than `useEffect` + `setState`. The clock
 * genuinely IS an external store, and this hook is the sanctioned way to read one
 * without cascading renders. It also solves hydration properly: React uses
 * `getServerSnapshot` (null) for the server render and the hydration pass, then
 * swaps to live time — so the server's clock and the browser's clock can never
 * disagree mid-hydration.
 */

type Remaining = { days: number; hours: number; minutes: number; seconds: number };

/**
 * A single shared 1Hz clock. The snapshot is cached and only reassigned on tick,
 * which is what `useSyncExternalStore` requires — returning a fresh `Date.now()`
 * on every call would spin forever.
 */
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
      }, 1000);

      return () => {
        listeners.delete(onChange);
        // Last subscriber leaves: stop the timer rather than leaking it.
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

function remainingUntil(target: number, now: number): Remaining | null {
  const ms = target - now;
  if (ms <= 0) return null;

  return {
    days: Math.floor(ms / 86_400_000),
    hours: Math.floor(ms / 3_600_000) % 24,
    minutes: Math.floor(ms / 60_000) % 60,
    seconds: Math.floor(ms / 1000) % 60,
  };
}

export function Countdown({ targetIso }: { targetIso: string }) {
  const now = useSyncExternalStore(
    clock.subscribe,
    clock.getSnapshot,
    clock.getServerSnapshot,
  );

  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;

  // `now` is null on the server and during hydration. Reserve the height so the
  // layout does not jump when the real value arrives.
  if (now === null) {
    return <div aria-hidden className="h-20" />;
  }

  const remaining = remainingUntil(target, now);

  if (!remaining) {
    return (
      <p className="font-display text-2xl italic text-foreground">
        Tonight, we celebrate.
      </p>
    );
  }

  const units: [number, string][] = [
    [remaining.days, "Days"],
    [remaining.hours, "Hours"],
    [remaining.minutes, "Minutes"],
    [remaining.seconds, "Seconds"],
  ];

  return (
    <div
      className="flex items-start justify-center gap-6 sm:gap-10"
      role="timer"
      // Announce once on arrival, not on every tick.
      aria-live="off"
      aria-label={`${remaining.days} days until the debut`}
    >
      {units.map(([value, label]) => (
        <div key={label} className="min-w-14 text-center">
          <div className="font-display text-4xl font-extralight tabular-nums text-foreground sm:text-5xl">
            {String(value).padStart(2, "0")}
          </div>
          <div className="mt-1 text-[0.6rem] uppercase tracking-editorial text-muted">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
