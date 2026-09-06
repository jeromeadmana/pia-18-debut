import { event } from "@/content/event.config";

/**
 * Placeholder-safe content accessors.
 *
 * `event.config.ts` ships with `REPLACE_ME` markers so it is obvious what still
 * needs filling in. Those markers are for whoever edits the config — they should
 * never reach a guest's screen, and they certainly should not end up in the
 * browser tab or a link preview.
 *
 * The rule is deliberately blunt: if a value still contains a marker, we do not
 * try to salvage part of it (stripping "REPLACE_ME Ballroom" down to "Ballroom"
 * would read as a real answer). We fall back to honest placeholder copy instead.
 *
 * Run `pnpm check:content` to list everything still unfilled.
 */

const PLACEHOLDER = /REPLACE_ME/;

export function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value);
}

/** The configured value, or `fallback` if it has not been filled in yet. */
export function resolved(value: string, fallback: string): string {
  return hasPlaceholder(value) ? fallback : value;
}

/**
 * The celebrant's full name, falling back to her first name.
 *
 * Used in the browser title and on the invitation, so "Pia REPLACE_ME" would be
 * conspicuous. "Pia" is simply a shorter correct answer.
 */
export function celebrantFullName(): string {
  return resolved(event.celebrant.fullName, event.celebrant.firstName);
}

export function venueName(): string {
  return resolved(event.venue.name, "Venue to be announced");
}

export function venueAddress(): string | null {
  return hasPlaceholder(event.venue.address) ? null : event.venue.address;
}

/** True when the maps link is real, so the button can be hidden until it is. */
export function hasVenueMap(): boolean {
  return !hasPlaceholder(event.venue.mapsUrl);
}

export function rsvpContact(): { name: string; phone: string } | null {
  if (hasPlaceholder(event.rsvp.contactName) || hasPlaceholder(event.rsvp.contactPhone)) {
    return null;
  }
  return { name: event.rsvp.contactName, phone: event.rsvp.contactPhone };
}
