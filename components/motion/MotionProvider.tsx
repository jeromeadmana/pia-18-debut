"use client";

import { LazyMotion, domAnimation } from "framer-motion";

/**
 * Framer Motion feature bundle.
 *
 * Every animated component in this project imports `m` rather than `motion`, and
 * sits under this provider. `m` ships no features on its own; `LazyMotion` loads
 * exactly one feature set — `domAnimation`, which covers transforms, opacity and
 * gestures. That is roughly a third of the full `motion` bundle.
 *
 * This matters here specifically: guests open the site on mid-range Android over
 * venue wifi in Manila, and the app is on Vercel Hobby. Animation should not be
 * the reason the invitation is slow to paint.
 *
 * `domAnimation` deliberately excludes layout projection (`domMax`). If a future
 * component genuinely needs shared layout animation, upgrade this one import
 * rather than reaching for `motion` at the call site — otherwise both bundles
 * ship.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  );
}
