import { event } from "@/content/event.config";

/**
 * The site's lifecycle.
 *
 * One site serves four different moments, and each wants a different front page:
 *
 *   countdown   — months out. Sell the evening, collect RSVPs.
 *   final-week  — RSVPs closing. Push the deadline, then the practicalities.
 *   event-day   — guests are on their phones, standing up, on venue wifi. They
 *                 want the table number and what is happening right now.
 *   past        — it is a memory. Thank-yous, photos, the guestbook archive.
 *
 * Deriving this from the date rather than a manual flag means nobody has to
 * remember to flip a switch at 6pm on the night.
 *
 * Every boundary is an absolute instant computed from `event.date.iso`, which
 * carries its own +08:00 offset. No local-timezone arithmetic, so a phone set to
 * the wrong zone still sees the right phase.
 */

export type EventPhase = "countdown" | "final-week" | "event-day" | "past";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** The programme runs ~6h from the 6pm start; after that the night is over. */
const EVENT_DURATION_MS = 6 * HOUR;

/** "Event day" opens 12h before the start — i.e. the morning of. */
const EVENT_DAY_LEAD_MS = 12 * HOUR;

const FINAL_WEEK_MS = 7 * DAY;

export function eventStartMs(): number {
  const parsed = Date.parse(event.date.iso);
  if (Number.isNaN(parsed)) {
    throw new Error(
      `event.date.iso is not a valid ISO-8601 instant: "${event.date.iso}"`,
    );
  }
  return parsed;
}

export function getEventPhase(now: number = Date.now()): EventPhase {
  const start = eventStartMs();

  if (now >= start + EVENT_DURATION_MS) return "past";
  if (now >= start - EVENT_DAY_LEAD_MS) return "event-day";
  if (now >= start - FINAL_WEEK_MS) return "final-week";
  return "countdown";
}

/**
 * RSVPs close at the deadline, and unconditionally once the night is over.
 *
 * The second clause matters: if the deadline were ever misconfigured to a date
 * after the debut, the form would still be accepting replies during the party.
 */
export function isRsvpClosed(now: number = Date.now()): boolean {
  const deadline = Date.parse(event.rsvp.deadlineIso);
  if (!Number.isNaN(deadline) && now > deadline) return true;
  return getEventPhase(now) === "past";
}

/**
 * Resolve each programme entry to an absolute instant.
 *
 * `event.program` stores display strings ("8:45 PM") because that is what the
 * invitation should print. For the live view we need real instants, so we parse
 * them against the debut's own date and offset rather than the viewer's clock.
 */
export type ProgramInstant = {
  time: string;
  title: string;
  detail: string | null;
  startsAt: number;
};

export function programWithInstants(): ProgramInstant[] {
  const iso = event.date.iso;
  const datePart = iso.slice(0, 10);
  const offset = iso.slice(19) || "+00:00";

  return event.program.map((item) => {
    const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(item.time.trim());

    if (!match) {
      // Unparseable time: keep the entry, drop it to the end of the ordering
      // rather than throwing and taking the whole page down mid-event.
      return { ...item, startsAt: Number.MAX_SAFE_INTEGER };
    }

    const [, rawHour, minutes, meridiem] = match;
    let hour = Number(rawHour) % 12;
    if (meridiem.toUpperCase() === "PM") hour += 12;

    const stamp = Date.parse(
      `${datePart}T${String(hour).padStart(2, "0")}:${minutes}:00${offset}`,
    );

    return { ...item, startsAt: Number.isNaN(stamp) ? Number.MAX_SAFE_INTEGER : stamp };
  });
}

/**
 * Index of the item happening now — the last one whose start time has passed.
 * Returns -1 before the programme begins.
 */
export function currentProgramIndex(
  program: readonly ProgramInstant[],
  now: number = Date.now(),
): number {
  let current = -1;
  for (let i = 0; i < program.length; i++) {
    if (program[i].startsAt <= now) current = i;
  }
  return current;
}
