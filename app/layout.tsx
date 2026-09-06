import type { Metadata } from "next";
import { Cormorant_Garamond, Geist } from "next/font/google";
import { event } from "@/content/event.config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/** Display face for the celebrant's name and section headings. */
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: `${event.celebrant.fullName} — ${event.celebrant.tagline}`,
  description: `${event.celebrant.firstName}'s ${event.celebrant.age}th birthday debut. ${event.date.displayDate}, ${event.date.displayYear}.`,
  // Invite links are private. Keep the whole site out of search results so a
  // code can never be discovered by searching a guest's name.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
