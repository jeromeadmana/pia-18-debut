import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  generateRsvpCode,
  generateUniqueCodes,
  isValidRsvpCode,
  normalizeRsvpCode,
} from "@/lib/codes";

describe("invite code alphabet", () => {
  it("is exactly 32 characters, so 5-bit sampling is unbiased", () => {
    expect(CODE_ALPHABET).toHaveLength(32);
  });

  it("contains no ambiguous glyphs", () => {
    for (const glyph of ["I", "O", "0", "1"]) {
      expect(CODE_ALPHABET).not.toContain(glyph);
    }
  });

  it("has no duplicate characters", () => {
    expect(new Set(CODE_ALPHABET).size).toBe(CODE_ALPHABET.length);
  });
});

describe("generateRsvpCode", () => {
  it("produces codes of the configured length using only the alphabet", () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRsvpCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(isValidRsvpCode(code)).toBe(true);
    }
  });

  it("reaches every character in the alphabet over enough draws", () => {
    // Guards against an off-by-one in the bit mask silently excluding a slice
    // of the alphabet — which would quietly shrink the keyspace.
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) {
      for (const char of generateRsvpCode()) seen.add(char);
    }
    expect(seen.size).toBe(CODE_ALPHABET.length);
  });

  it("rejects nonsensical lengths", () => {
    expect(() => generateRsvpCode(0)).toThrow();
    expect(() => generateRsvpCode(-1)).toThrow();
    expect(() => generateRsvpCode(1.5)).toThrow();
  });
});

describe("normalizeRsvpCode", () => {
  it("uppercases and strips the separators guests actually type", () => {
    expect(normalizeRsvpCode(" debut2 ")).toBe("DEBUT2");
    expect(normalizeRsvpCode("deb-ut2")).toBe("DEBUT2");
    expect(normalizeRsvpCode("DEB UT2")).toBe("DEBUT2");
    expect(normalizeRsvpCode("deb_ut2")).toBe("DEBUT2");
  });

  it("does NOT strip out-of-alphabet characters", () => {
    // Stripping them would silently shorten a typo into a different valid code,
    // which could hand a guest someone else's invitation.
    expect(normalizeRsvpCode("DEBUT0")).toBe("DEBUT0");
    expect(isValidRsvpCode(normalizeRsvpCode("DEBUT0"))).toBe(false);
  });
});

describe("isValidRsvpCode", () => {
  it("accepts a well-formed code", () => {
    expect(isValidRsvpCode("DEBUT2")).toBe(true);
  });

  it("rejects wrong length, ambiguous glyphs, and lowercase", () => {
    expect(isValidRsvpCode("DEBUT")).toBe(false);
    expect(isValidRsvpCode("DEBUT23")).toBe(false);
    expect(isValidRsvpCode("DEBUTO")).toBe(false); // letter O
    expect(isValidRsvpCode("DEBUT1")).toBe(false); // digit one
    expect(isValidRsvpCode("debut2")).toBe(false);
    expect(isValidRsvpCode("")).toBe(false);
  });
});

describe("generateUniqueCodes", () => {
  it("returns the requested number of distinct codes", () => {
    const codes = generateUniqueCodes(200);
    expect(codes).toHaveLength(200);
    expect(new Set(codes).size).toBe(200);
  });
});
