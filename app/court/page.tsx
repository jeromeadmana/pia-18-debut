import { listCourt } from "@/db/queries";
import { isConnectionError } from "@/db/client";
import { event, type CourtCategory } from "@/content/event.config";
import { CourtTabs } from "@/components/CourtTabs";
import { SiteHeader } from "@/components/SiteHeader";

/**
 * The 18s Court — public, and cached.
 *
 * ISR with a 5-minute window: the roster changes a handful of times in the weeks
 * before the debut, but the page may be opened by every guest on the night. One
 * cached render serves all of them, so this page costs roughly zero database
 * reads under load.
 *
 * After editing the roster, call `revalidatePath('/court')` to publish
 * immediately rather than waiting out the window.
 *
 * The data is fetched here on the server and handed to a client component for
 * tabs and search — so the names are in the HTML for anyone who never gets the
 * JavaScript, and filtering costs no round trip for everyone who does.
 */
export const revalidate = 300;

export default async function CourtPage() {
  const court = await loadCourt();

  // Preserve the ceremonial order from the config rather than whatever order the
  // database returns.
  const categories = (Object.keys(event.court) as CourtCategory[]).filter(
    (category) => (court[category]?.length ?? 0) > 0,
  );

  return (
    <>
      <SiteHeader current="court" />

      <main className="mx-auto max-w-3xl flex-1 px-6 py-24">
        <header className="text-center">
          <p className="text-[0.65rem] uppercase tracking-engraved text-accent">Her Court</p>
          <h1 className="mt-3 font-display text-5xl font-light text-burgundy">
            The Eighteens
          </h1>
        </header>

        {categories.length === 0 ? (
          <p className="mt-16 text-center text-sm text-ink-muted">
            The court will be announced soon.
          </p>
        ) : (
          <CourtTabs court={court} categories={categories} />
        )}
      </main>
    </>
  );
}

/**
 * Load the court, tolerating a sleeping database.
 *
 * This page is prerendered, so a Neon free-tier compute that happens to be
 * suspended when a deploy runs would otherwise fail the entire build. A
 * transient connection failure degrades to the "announced soon" state instead,
 * and ISR replaces it with real data within the revalidate window.
 *
 * Only CONNECTION failures are swallowed. A genuine fault — a missing
 * DATABASE_URL, a bad query, a schema drift — is rethrown and fails the build,
 * which is what should happen to a misconfiguration.
 */
async function loadCourt() {
  try {
    return await listCourt();
  } catch (error) {
    if (!isConnectionError(error)) throw error;

    console.error(
      "[court] database unreachable during render — serving the empty state; " +
        "ISR will retry within the revalidate window.",
      error,
    );
    return {} as Awaited<ReturnType<typeof listCourt>>;
  }
}
