"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Presentation shell for a multi-step form.
 *
 * Holds no form state — the wizard owning the data passes `step` in and gets
 * navigation callbacks back. That keeps validation and submission in one place
 * rather than smeared across step components.
 *
 * The progress rail is `<ol>` with `aria-current`, so the position is announced
 * rather than being purely visual. Completed steps are clickable to go back;
 * steps ahead are not, because skipping forward past an unanswered step is how
 * you get a half-filled submission.
 */

export type Step = { id: string; label: string };

export function StepWizard({
  steps,
  current,
  onJump,
  children,
}: {
  steps: readonly Step[];
  current: number;
  onJump: (index: number) => void;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <div>
      <ol className="flex items-center gap-2" aria-label="RSVP progress">
        {steps.map((step, i) => {
          const done = i < current;
          const active = i === current;

          return (
            <li key={step.id} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                // Only backwards. Jumping ahead skips validation.
                disabled={!done}
                onClick={() => done && onJump(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex-1 border-t-2 pt-3 text-left text-[0.55rem] uppercase tracking-editorial transition",
                  active && "border-accent text-foreground",
                  done && "border-accent/50 text-muted hover:text-foreground",
                  !active && !done && "border-hairline text-muted/60",
                  !done && "cursor-default",
                )}
              >
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>

      {/*
        `mode="wait"` so the outgoing step finishes before the next arrives —
        cross-fading two forms on top of each other looks like a glitch, and
        briefly doubles the focusable controls.
      */}
      <AnimatePresence mode="wait" initial={false}>
        <m.div
          key={current}
          initial={reduced ? false : { opacity: 0, x: 24 }}
          animate={reduced ? {} : { opacity: 1, x: 0 }}
          exit={reduced ? {} : { opacity: 0, x: -24 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
          {children}
        </m.div>
      </AnimatePresence>
    </div>
  );
}

export function StepHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="mt-8">
      <h2 className="font-display text-3xl font-light text-foreground">{title}</h2>
      {hint && <p className="mt-2 text-sm leading-relaxed text-muted">{hint}</p>}
    </header>
  );
}

export function StepNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  nextDisabled,
  busy,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="mt-10 flex items-center gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-full border border-hairline px-6 py-3 text-xs uppercase tracking-engraved text-muted transition hover:text-foreground"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled || busy}
        className="min-h-12 flex-1 rounded-full bg-foreground px-8 py-3 text-xs uppercase tracking-engraved text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Sending…" : nextLabel}
      </button>
    </div>
  );
}
