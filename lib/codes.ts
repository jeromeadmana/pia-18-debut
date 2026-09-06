/**
 * RSVP invite codes.
 *
 * These codes are the ONLY thing standing between a link and a guest's personal
 * details, and they get read aloud, retyped from a printed card, and forwarded
 * over chat. Two properties matter:
 *
 *   1. No ambiguous glyphs. The alphabet omits I, O, 0 and 1 entirely, so a code
 *      can never contain a character a guest has to squint at. We deliberately
 *      drop BOTH members of each confusable pair rather than auto-correcting one
 *      into the other — a code that cannot be misread beats a code we try to
 *      guess the intent of.
 *   2. Unbiased randomness. The alphabet is exactly 32 characters, so each
 *      character consumes 5 random bits with no modulo bias.
 *
 * 32^6 ≈ 1.07 billion codes — vastly more than a guest list, so brute-forcing a
 * valid code is impractical even before rate limiting.
 */

/** A-Z without I and O, digits 2-9. Exactly 32 characters. */
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const CODE_LENGTH = 6;

/** Low 5 bits: 2^5 === CODE_ALPHABET.length === 32. */
const MASK = 0b11111;

/**
 * Generate a cryptographically random invite code.
 * Uses Web Crypto, so it runs unchanged in Node, the Edge runtime, and scripts.
 */
export function generateRsvpCode(length: number = CODE_LENGTH): string {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error(`Invalid code length: ${length}`);
  }

  // One byte per character; we take the low 5 bits of each. This is exactly
  // uniform because 256 is a whole multiple of 32 (each residue occurs 8 times).
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[bytes[i] & MASK];
  }
  return code;
}

/**
 * Clean up what a guest actually typed before lookup.
 *
 * Handles the realistic cases: lowercase from a phone keyboard, and the dashes
 * or spaces people insert when reading a code off a card ("a7k - 2m9").
 * Characters outside the alphabet are NOT stripped — that would silently shorten
 * the code and turn a typo into a different valid lookup. They stay, fail
 * validation, and produce an honest "we couldn't find that code".
 */
export function normalizeRsvpCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s\-_]/g, "");
}

/** Does this string look like a well-formed code? Cheap pre-check before a DB hit. */
export function isValidRsvpCode(code: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code);
}

/**
 * Generate `count` distinct codes. Used when bulk-creating invites so the caller
 * never has to dedupe against itself before hitting the unique constraint.
 */
export function generateUniqueCodes(count: number): string[] {
  const codes = new Set<string>();
  // Bounded so a pathological RNG can never spin forever.
  const maxAttempts = count * 50;

  for (let attempts = 0; codes.size < count && attempts < maxAttempts; attempts++) {
    codes.add(generateRsvpCode());
  }

  if (codes.size < count) {
    throw new Error(`Could only generate ${codes.size} of ${count} unique codes`);
  }
  return [...codes];
}
