import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * List everything still marked REPLACE_ME.
 *
 * The site degrades gracefully around unfilled values (see `lib/content.ts`) —
 * the venue reads "to be announced", the contact line disappears rather than
 * printing a marker. That is good for guests but bad for you, because nothing
 * shouts that the config is incomplete.
 *
 * This is the shout. Run it before deploying, or wire it into CI.
 *
 * Usage:  pnpm check:content
 * Exits 1 when anything is unfilled, so it can gate a deploy.
 */

const TARGETS = [
  join("content", "event.config.ts"),
  join("content", "court.seed.csv"),
];

type Finding = { file: string; line: number; text: string };

function scan(file: string): Finding[] {
  let contents: string;
  try {
    contents = readFileSync(join(process.cwd(), file), "utf8");
  } catch {
    console.warn(`  ! could not read ${file}`);
    return [];
  }

  return contents
    .split(/\r?\n/)
    .map((text, i) => ({ file, line: i + 1, text: text.trim() }))
    .filter((row) => row.text.includes("REPLACE_ME"))
    // Comment lines describe the markers rather than being one.
    .filter((row) => !row.text.startsWith("*") && !row.text.startsWith("/*"));
}

const findings = TARGETS.flatMap(scan);

if (findings.length === 0) {
  console.log("All content is filled in. Nothing left marked REPLACE_ME.");
  process.exit(0);
}

// Roster rows are numerous and identical in shape; summarise rather than list 54.
const roster = findings.filter((f) => f.file.endsWith(".csv"));
const config = findings.filter((f) => !f.file.endsWith(".csv"));

console.log(`${findings.length} placeholder${findings.length === 1 ? "" : "s"} remaining:\n`);

for (const finding of config) {
  const preview = finding.text.length > 88 ? `${finding.text.slice(0, 85)}…` : finding.text;
  console.log(`  ${finding.file}:${finding.line}  ${preview}`);
}

if (roster.length > 0) {
  console.log(
    `\n  ${roster[0].file}  ${roster.length} roster row${roster.length === 1 ? "" : "s"} still unnamed`,
  );
}

console.log("\nThe site hides these from guests, but they are not real content yet.");
process.exit(1);
