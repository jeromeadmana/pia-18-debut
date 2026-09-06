"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

/**
 * Operator login.
 *
 * The only unauthenticated page under /admin. It says nothing about the site or
 * the event — no celebrant name, no branding cues — so a stray visitor learns
 * nothing from finding it.
 */
export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

/** Wrapped in Suspense because useSearchParams opts the tree into CSR bailout. */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data?.message ?? "Sign in failed.");
        return;
      }

      // Only ever follow a same-site absolute path, so a crafted ?next= cannot
      // bounce the operator to another origin after a successful login.
      const next = searchParams.get("next");
      const destination = next && /^\/admin(\/|$)/.test(next) ? next : "/admin";

      router.replace(destination);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-24">
      <h1 className="text-center font-display text-3xl font-light text-burgundy">
        Sign in
      </h1>

      <form onSubmit={handleSubmit} className="mt-8">
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-sm border border-hairline bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-gold"
        />

        {error && (
          <p role="alert" className="mt-3 text-center text-xs text-rose">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || password.length === 0}
          className="mt-5 min-h-12 w-full rounded-full bg-burgundy px-8 py-3 text-sm uppercase tracking-engraved text-ivory transition hover:bg-ink disabled:opacity-40"
        >
          {submitting ? "Checking…" : "Continue"}
        </button>
      </form>
    </main>
  );
}
