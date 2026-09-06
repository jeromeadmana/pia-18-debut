import Link from "next/link";
import { event } from "@/content/event.config";

/**
 * Shared header for every page except the home page.
 *
 * The home page is a full-bleed hero and deliberately has no chrome above it, so
 * this is added per page rather than dropped into the root layout — putting it in
 * the layout would either push the hero below the fold or require a client
 * component just to read the pathname.
 *
 * **If you add a page under `app/`, add this to it.** Without it there is no way
 * back to the invitation, which is exactly the trap /court, /rsvp, /live and
 * /i/[code] all fell into before.
 */

type NavKey = "court" | "rsvp" | "live";

const LINKS: { key: NavKey; href: "/court" | "/rsvp" | "/live"; label: string }[] = [
  { key: "court", href: "/court", label: "The Eighteens" },
  { key: "rsvp", href: "/rsvp", label: "RSVP" },
];

export function SiteHeader({ current }: { current?: NavKey }) {
  return (
    <header className="border-b border-hairline bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <Link
          href="/"
          className="group flex items-baseline gap-2"
          aria-label={`${event.celebrant.firstName}'s debut — home`}
        >
          <span aria-hidden className="text-accent transition group-hover:-translate-x-0.5">
            &larr;
          </span>
          <span className="font-display text-lg text-foreground">
            {event.celebrant.firstName}
          </span>
          <span className="hidden font-display text-sm italic text-muted sm:inline">
            {event.celebrant.tagline}
          </span>
        </Link>

        <nav className="flex items-center gap-1" aria-label="Main">
          {LINKS.map((link) => (
            <Link
              key={link.key}
              href={link.href}
              aria-current={current === link.key ? "page" : undefined}
              className={`rounded-full px-3 py-2 text-[0.7rem] uppercase tracking-wide transition ${
                current === link.key
                  ? "text-foreground"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
