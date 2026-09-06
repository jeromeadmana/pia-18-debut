import Link from "next/link";
import { event } from "@/content/event.config";
import { SiteHeader } from "@/components/SiteHeader";
import { rsvpContact } from "@/lib/content";

/**
 * 404.
 *
 * This is not a generic error page — it is mostly reached by a guest who
 * mistyped their invitation code, since `/i/[code]` calls `notFound()` for any
 * code it cannot resolve. So the copy addresses that case first and offers the
 * two things that actually help: try the code again, or ask a human.
 *
 * It stays deliberately vague about *why* the code failed. A malformed code and
 * an unknown code produce the identical response, so this page cannot be used to
 * work out which codes exist.
 */
export const metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  const contact = rsvpContact();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-24 text-center">
        <p className="text-[0.65rem] uppercase tracking-engraved text-gold">
          We couldn&apos;t find that
        </p>

        <h1 className="mt-4 font-display text-4xl font-light text-burgundy">
          This page doesn&apos;t exist
        </h1>

        <p className="mt-6 text-sm leading-relaxed text-ink-muted">
          If you were opening an invitation, the code may have been mistyped — it
          is six characters and contains no letter O or the digits 0 or 1.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/rsvp"
            className="min-h-12 rounded-full bg-burgundy px-8 py-3 text-sm uppercase tracking-engraved text-ivory transition hover:bg-ink"
          >
            Try your code again
          </Link>
          <Link
            href="/"
            className="min-h-12 rounded-full border border-gold/50 px-8 py-3 text-sm uppercase tracking-engraved text-burgundy transition hover:bg-champagne/40"
          >
            Back to the invitation
          </Link>
        </div>

        {contact && (
          <p className="mt-8 text-xs leading-relaxed text-ink-muted">
            Still stuck? Message {contact.name} at {contact.phone}.
          </p>
        )}

        <p className="mt-8 font-display text-sm italic text-ink-muted">
          {event.celebrant.firstName} &middot; {event.celebrant.tagline}
        </p>
      </main>
    </>
  );
}
