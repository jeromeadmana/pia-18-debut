"use client";

/**
 * Tiny client island so the rest of the pass stays server-rendered.
 *
 * `window.print()` hands off to the browser's own print dialogue, which is also
 * where "Save as PDF" lives on every desktop and modern mobile browser. That is
 * why there is no PDF library here: the platform already does it, offline, at no
 * serverless cost.
 */
export function PrintButton({ label = "Print / Save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="min-h-12 w-full rounded-full bg-foreground px-6 py-3 text-xs uppercase tracking-engraved text-background transition hover:opacity-90"
    >
      {label}
    </button>
  );
}
