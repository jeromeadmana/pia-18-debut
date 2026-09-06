/**
 * Single source of truth for every user-facing string and date on the site.
 *
 * Swap the `REPLACE_ME` values for the real details and the whole site updates —
 * no component edits required. Nothing in `app/` or `components/` should hardcode
 * event copy; import from here instead.
 *
 * The 18s roster is NOT here — court members live in the database so they can be
 * linked to real invites. Seed them from `content/court.seed.csv`.
 */

export type CourtCategory =
  | "roses"
  | "candles"
  | "treasures"
  | "bills"
  | "shots"
  | "cotillion";

export const event = {
  celebrant: {
    firstName: "Pia",
    /** REPLACE_ME — full name as it should appear on the formal invitation. */
    fullName: "Pia REPLACE_ME",
    age: 18,
    /** REPLACE_ME — the formal one-line tagline under the name. */
    tagline: "A Debut Celebration",
  },

  /**
   * Debut date/time. `iso` drives the countdown timer and the RSVP deadline logic,
   * so it MUST stay a valid ISO-8601 string with an explicit offset.
   * +08:00 = Asia/Manila. Change the offset if the debut is held abroad.
   */
  date: {
    iso: "2028-10-10T18:00:00+08:00",
    timeZone: "Asia/Manila",
    /** Display strings — kept separate so we never reformat dates in the browser locale. */
    displayDate: "Tuesday, the tenth of October",
    displayYear: "Two Thousand Twenty-Eight",
    displayTime: "Six o'clock in the evening",
    /** Doors open before the program begins. */
    callTime: "Five o'clock in the evening",
  },

  venue: {
    /** REPLACE_ME — venue name and hall. */
    name: "REPLACE_ME Ballroom",
    /** REPLACE_ME — full street address for navigation. */
    address: "REPLACE_ME Street, REPLACE_ME City, Philippines",
    /** REPLACE_ME — paste the Google Maps share link. */
    mapsUrl: "https://maps.google.com/?q=REPLACE_ME",
    /** REPLACE_ME — Waze deep link, optional. Set to null to hide the Waze button. */
    wazeUrl: null as string | null,
    /**
     * REPLACE_ME — Google Maps EMBED src (Share > Embed a map > copy the src="...").
     * Set to null to render a static map card + link instead of an iframe, which is
     * the lighter option and avoids a third-party frame on first paint.
     */
    embedUrl: null as string | null,
    parkingNote: "Valet and self-parking are available on site.",
  },

  attire: {
    dressCode: "Formal / Black Tie",
    /** Shown as the one-line rule guests actually need. */
    guidance:
      "Floor-length gowns and dark formal suits. We kindly ask guests to avoid white and ivory.",
    /** Palette swatches for the mood board. Hex values render as chips. */
    palette: [
      { name: "Champagne", hex: "#E8D5B7" },
      { name: "Dusty Rose", hex: "#C9A0A0" },
      { name: "Deep Burgundy", hex: "#5C2A34" },
      { name: "Antique Gold", hex: "#B08D57" },
      { name: "Ivory", hex: "#F5F1E8" },
    ],
  },

  /** Evening timeline. Times are display-only strings, not parsed. */
  program: [
    { time: "5:00 PM", title: "Guest Arrival & Cocktails", detail: "Registration and seating" },
    { time: "6:00 PM", title: "Grand Entrance", detail: "Presentation of the debutante" },
    { time: "6:20 PM", title: "Opening Prayer & Welcome", detail: null },
    { time: "6:40 PM", title: "Dinner Is Served", detail: null },
    { time: "7:30 PM", title: "The Cotillion Waltz", detail: "The debutante and her court" },
    { time: "8:00 PM", title: "The 18 Roses", detail: "A dance with each of the eighteen" },
    { time: "8:45 PM", title: "The 18 Candles", detail: "Eighteen wishes, eighteen flames" },
    { time: "9:15 PM", title: "The 18 Treasures", detail: null },
    { time: "9:45 PM", title: "Message of Thanks", detail: "From the debutante and her family" },
    { time: "10:00 PM", title: "Open Dance Floor", detail: "The celebration continues" },
  ],

  /** Copy for each 18s group. The names themselves come from the database. */
  court: {
    roses: {
      label: "18 Roses",
      blurb: "Eighteen gentlemen, eighteen roses, and a dance with each.",
    },
    candles: {
      label: "18 Candles",
      blurb: "Eighteen women who light the way with a wish and a word.",
    },
    treasures: {
      label: "18 Treasures",
      blurb: "Eighteen gifts, each carrying a lesson for the years ahead.",
    },
    bills: {
      label: "18 Blue Bills",
      blurb: "A tradition of prosperity for the journey ahead.",
    },
    shots: {
      label: "18 Shots",
      blurb: "Eighteen toasts to the years behind and the ones to come.",
    },
    cotillion: {
      label: "Cotillion Court",
      blurb: "The waltz that opens the evening.",
    },
  } satisfies Record<CourtCategory, { label: string; blurb: string }>,

  rsvp: {
    /** Invitations close at this instant. Must be a valid ISO-8601 string. */
    deadlineIso: "2028-09-26T23:59:59+08:00",
    deadlineDisplay: "the twenty-sixth of September",
    contactName: "REPLACE_ME",
    /** REPLACE_ME — where guests reply if their code does not work. */
    contactPhone: "REPLACE_ME",
  },

  gifts: {
    heading: "With Gratitude",
    /**
     * Monetary-gift etiquette. Deliberately indirect — this is the phrasing
     * convention for Filipino debuts. Reword freely.
     */
    body:
      "Your presence at Pia's debut is the only gift she has asked for. " +
      "Should you wish to honour her with something more, a contribution toward " +
      "her college fund would be received with deep gratitude.",
  },

  /**
   * Pre-debut photoshoot. `width`/`height` are the true pixel dimensions — they are
   * required so the browser reserves space and the gallery does not shift on load.
   *
   * `publicId` is the Cloudinary public ID. While it is null the image is served
   * from `/public/gallery` unoptimised; fill these in after uploading and the
   * Cloudinary loader takes over automatically. See `lib/cloudinary.ts`.
   */
  gallery: [
    { src: "/gallery/pia-01.jpg", publicId: null, width: 1536, height: 2048, alt: "Pia, pre-debut portrait" },
    { src: "/gallery/pia-02.jpg", publicId: null, width: 1536, height: 2048, alt: "Pia, pre-debut portrait" },
    { src: "/gallery/pia-03.jpg", publicId: null, width: 1536, height: 2048, alt: "Pia, pre-debut portrait" },
    { src: "/gallery/pia-04.jpg", publicId: null, width: 2048, height: 1536, alt: "Pia, pre-debut portrait" },
    { src: "/gallery/pia-05.jpg", publicId: null, width: 2048, height: 1536, alt: "Pia, pre-debut portrait" },
    { src: "/gallery/pia-06.jpg", publicId: null, width: 1103, height: 2048, alt: "Pia, pre-debut portrait" },
    { src: "/gallery/pia-07.jpg", publicId: null, width: 1536, height: 2048, alt: "Pia, pre-debut portrait" },
  ] satisfies ReadonlyArray<{
    src: string;
    publicId: string | null;
    width: number;
    height: number;
    alt: string;
  }>,

  guestbook: {
    heading: "Wishes for Pia",
    prompt: "Leave her a note she can read for years.",
    /** Messages are held for approval before appearing publicly. */
    moderationNotice: "Messages appear once reviewed.",
    maxLength: 500,
  },
} as const;

export type EventConfig = typeof event;
