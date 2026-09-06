"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CODE_LENGTH, isValidRsvpCode, normalizeRsvpCode } from "@/lib/codes";
import { SiteHeader } from "@/components/SiteHeader";
import { rsvpContact } from "@/lib/content";

/**
 * Code entry — the way back in for a guest who has the code but not the link.
 *
 * Validation happens locally against the alphabet, so an obviously malformed
 * code never costs a database round trip. A well-formed but unknown code is
 * resolved by the invite page itself, which 404s identically for "wrong shape"
 * and "no such invite".
 *
 * PASS 1 SCOPE: this is the lookup. The RSVP form itself lands in pass 2 on the
 * invite page, backed by the existing /api/rsvp route.
 */
export default function RsvpLookupPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const normalized = normalizeRsvpCode(code);
  const contact = rsvpContact();

  function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();

    if (!isValidRsvpCode(normalized)) {
      setError(`Please enter the ${CODE_LENGTH}-character code from your invitation.`);
      return;
    }
    setError(null);
    router.push(`/i/${normalized}`);
  }

  return (
    <>
      <SiteHeader current="rsvp" />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-24">
        <header className="text-center">
          <p className="text-[0.65rem] uppercase tracking-engraved text-gold">
            Kindly reply
          </p>
          <h1 className="mt-3 font-display text-4xl font-light text-burgundy">
            Find your invitation
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Enter the {CODE_LENGTH}-character code printed on your invitation.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="mt-10">
          <label htmlFor="code" className="sr-only">
            Invitation code
          </label>
          <input
            id="code"
            name="code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            // A short alphanumeric code — inputMode "text" keeps the full keyboard
            // available on mobile, since the alphabet mixes letters and digits.
            inputMode="text"
            maxLength={12}
            placeholder="DEBUT2"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
            className="w-full rounded-sm border border-hairline bg-white px-4 py-4 text-center font-display text-2xl uppercase tracking-engraved text-burgundy outline-none transition focus:border-gold"
          />

          {error && (
            <p id="code-error" role="alert" className="mt-3 text-center text-xs text-rose">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="mt-6 w-full rounded-full bg-burgundy px-8 py-3 text-sm uppercase tracking-engraved text-ivory transition hover:bg-ink disabled:opacity-40"
            disabled={normalized.length === 0}
          >
            Continue
          </button>
        </form>

        {contact && (
          <p className="mt-10 text-center text-xs leading-relaxed text-ink-muted">
            Can&apos;t find your code? Message {contact.name} at {contact.phone}.
          </p>
        )}
      </main>
    </>
  );
}
