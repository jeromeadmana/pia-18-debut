import type { Metadata } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import { event } from "@/content/event.config";
import { celebrantFullName } from "@/lib/content";
import "./globals.css";

/**
 * Two faces, doing two different jobs.
 *
 * Cormorant Garamond is a high-contrast display serif — thin strokes, sharp
 * modulation. It only works at large sizes and light weights, which is exactly
 * where it is used: the celebrant's name, section headings, numerals.
 *
 * Plus Jakarta Sans carries everything small. It replaces Geist because it holds
 * its shape better at the 10–12px uppercase tracking this design leans on, which
 * is most of the interface.
 *
 * Both are self-hosted and subsetted by `next/font`, so there is no third-party
 * request and no layout shift from a late-arriving webfont.
 */

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  // `celebrantFullName()` falls back to the first name while `fullName` is still
  // a REPLACE_ME placeholder, so the browser tab never advertises an unfilled
  // config value.
  title: `${celebrantFullName()} — ${event.celebrant.tagline}`,
  description: `${event.celebrant.firstName}'s ${event.celebrant.age}th birthday debut. ${event.date.displayDate}, ${event.date.displayYear}.`,
  // Invite links are private. Keep the whole site out of search results so a
  // code can never be discovered by searching a guest's name.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${cormorant.variable} h-full antialiased`}
    >
      {/*
        `surface-ivory` is the default ground; obsidian sections opt in with
        `surface-obsidian`. `grain` adds the fixed film-grain overlay via ::after.
      */}
      <body className="surface-ivory grain flex min-h-full flex-col">{children}</body>
    </html>
  );
}
