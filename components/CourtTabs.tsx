"use client";

import { useMemo, useState } from "react";
import { event, type CourtCategory } from "@/content/event.config";

/**
 * The 18s court: tabs plus a search that spans every category.
 *
 * The interaction problem this solves: a guest arriving here usually wants ONE
 * answer — "am I in this, and which one?" Tabs alone make that a hunt through
 * six lists. So search is global and, when active, it overrides the tabs and
 * shows matches grouped by category, with the group named on every hit.
 *
 * All the data is already in the client bundle (it is a public list of at most
 * ~108 names), so filtering is instant and costs no network round trip. That
 * matters on venue wifi.
 *
 * Tabs implement the ARIA tabs pattern including arrow-key navigation, since
 * this is the one genuinely interactive control on a public page.
 */

export type CourtEntry = {
  position: number;
  displayName: string;
  dedication: string | null;
};

type Props = {
  court: Partial<Record<CourtCategory, CourtEntry[]>>;
  categories: CourtCategory[];
};

export function CourtTabs({ court, categories }: Props) {
  const [active, setActive] = useState<CourtCategory>(categories[0]);
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!term) return null;

    return categories
      .map((category) => ({
        category,
        entries: (court[category] ?? []).filter((entry) =>
          entry.displayName.toLowerCase().includes(term),
        ),
      }))
      .filter((group) => group.entries.length > 0);
  }, [term, categories, court]);

  const matchCount = matches?.reduce((sum, g) => sum + g.entries.length, 0) ?? 0;

  function handleTabKey(keyEvent: React.KeyboardEvent, index: number) {
    const delta = keyEvent.key === "ArrowRight" ? 1 : keyEvent.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;

    keyEvent.preventDefault();
    const next = (index + delta + categories.length) % categories.length;
    setActive(categories[next]);
    document.getElementById(`court-tab-${categories[next]}`)?.focus();
  }

  return (
    <div className="mt-12">
      <div className="mx-auto max-w-sm">
        <label htmlFor="court-search" className="sr-only">
          Search the court by name
        </label>
        <input
          id="court-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for your name…"
          autoComplete="off"
          className="w-full rounded-full border border-hairline bg-white px-5 py-3 text-center text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-accent"
        />
      </div>

      {/* Search results replace the tabs entirely — two competing views on one
          screen is how you get a guest reading the wrong list. */}
      {matches ? (
        <section className="mt-10" aria-live="polite">
          <p className="text-center text-xs text-ink-muted">
            {matchCount === 0
              ? "No one by that name in the court."
              : `${matchCount} ${matchCount === 1 ? "match" : "matches"}`}
          </p>

          <div className="mt-8 space-y-10">
            {matches.map((group) => (
              <section key={group.category}>
                <h3 className="font-display text-2xl font-light text-burgundy">
                  {event.court[group.category].label}
                </h3>
                <ol className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {group.entries.map((entry) => (
                    <CourtRow
                      key={`${group.category}-${entry.position}`}
                      entry={entry}
                      highlight={term}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </section>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="The eighteens"
            className="mt-10 flex flex-wrap justify-center gap-2"
          >
            {categories.map((category, index) => {
              const selected = category === active;
              return (
                <button
                  key={category}
                  id={`court-tab-${category}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`court-panel-${category}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(category)}
                  onKeyDown={(e) => handleTabKey(e, index)}
                  className={`min-h-11 rounded-full border px-5 py-2 text-xs uppercase tracking-wide transition ${
                    selected
                      ? "border-burgundy bg-burgundy text-ivory"
                      : "border-hairline bg-white text-ink-muted hover:border-accent"
                  }`}
                >
                  {event.court[category].label}
                </button>
              );
            })}
          </div>

          <section
            id={`court-panel-${active}`}
            role="tabpanel"
            aria-labelledby={`court-tab-${active}`}
            tabIndex={0}
            className="mt-10"
          >
            <p className="text-center text-sm italic text-ink-muted">
              {event.court[active].blurb}
            </p>

            <ol className="mt-8 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {(court[active] ?? []).map((entry) => (
                <CourtRow key={`${active}-${entry.position}`} entry={entry} />
              ))}
            </ol>
          </section>
        </>
      )}
    </div>
  );
}

function CourtRow({ entry, highlight }: { entry: CourtEntry; highlight?: string }) {
  return (
    <li className="grid grid-cols-[2rem_1fr] items-baseline border-b border-hairline pb-3">
      <span className="text-xs tabular-nums text-accent">
        {String(entry.position).padStart(2, "0")}
      </span>
      <span>
        <span className="text-burgundy">
          {highlight ? <Highlighted text={entry.displayName} term={highlight} /> : entry.displayName}
        </span>
        {entry.dedication && (
          <span className="mt-1 block text-xs italic text-ink-muted">{entry.dedication}</span>
        )}
      </span>
    </li>
  );
}

/**
 * Mark the matched span. Built by index rather than by regex so a name
 * containing regex metacharacters cannot break rendering.
 */
function Highlighted({ text, term }: { text: string; term: string }) {
  const start = text.toLowerCase().indexOf(term);
  if (start === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-champagne/70 text-burgundy">
        {text.slice(start, start + term.length)}
      </mark>
      {text.slice(start + term.length)}
    </>
  );
}
