"use client";

import { useEffect, useState } from "react";
import { event } from "@/content/event.config";

/**
 * The wishes wall.
 *
 * Messages are fetched on the client rather than rendered on the server, which
 * is deliberate: it keeps the home page fully static (prerendered once, zero
 * serverless invocations for every guest who never scrolls this far), while the
 * wall itself stays live.
 *
 * Everything posted here lands unapproved — see `createGuestbookMessage`. The
 * copy says so plainly rather than implying the message is already public, so
 * nobody posts twice thinking it failed.
 */

type Message = {
  id: number;
  authorName: string;
  body: string;
  createdAt: string;
};

type LoadState = "loading" | "ready" | "error";

export function Guestbook() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/guestbook")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok) {
          setMessages(data.messages);
          setLoadState("ready");
        } else {
          setLoadState("error");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const remaining = event.guestbook.maxLength - body.length;

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);

    if (!authorName.trim() || !body.trim()) {
      setError("Please add your name and a message.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: authorName.trim(), body: body.trim() }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setPosted(true);
      setAuthorName("");
      setBody("");
    } catch {
      setError("We couldn't reach the server. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="border-t border-hairline bg-champagne/20 px-6 py-24">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <p className="text-[0.65rem] uppercase tracking-engraved text-gold">
            Guestbook
          </p>
          <h2 className="mt-3 font-display text-4xl font-light text-burgundy">
            {event.guestbook.heading}
          </h2>
          <p className="mt-3 text-sm text-ink-muted">{event.guestbook.prompt}</p>
        </header>

        {posted ? (
          <p
            role="status"
            className="mt-10 rounded-sm border border-gold/40 bg-ivory px-6 py-6 text-center text-sm text-burgundy"
          >
            Thank you — your wish has been sent.
            <span className="mt-1 block text-xs text-ink-muted">
              {event.guestbook.moderationNotice}
            </span>
            <button
              type="button"
              onClick={() => setPosted(false)}
              className="mt-4 text-xs uppercase tracking-wide text-gold underline-offset-4 hover:underline"
            >
              Leave another
            </button>
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10">
            <label htmlFor="wish-name" className="sr-only">
              Your name
            </label>
            <input
              id="wish-name"
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={80}
              placeholder="Your name"
              className="w-full rounded-sm border border-hairline bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-gold"
            />

            <label htmlFor="wish-body" className="sr-only">
              Your message
            </label>
            <textarea
              id="wish-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={event.guestbook.maxLength}
              rows={4}
              placeholder={`A wish for ${event.celebrant.firstName}…`}
              className="mt-2 w-full resize-y rounded-sm border border-hairline bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-ink-muted/70 focus:border-gold"
            />

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-ink-muted">
                {event.guestbook.moderationNotice}
              </span>
              <span
                className={`text-xs tabular-nums ${
                  remaining < 40 ? "text-rose" : "text-ink-muted"
                }`}
              >
                {remaining}
              </span>
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-sm border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-burgundy"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 min-h-12 w-full rounded-full bg-burgundy px-8 py-3 text-sm uppercase tracking-engraved text-ivory transition hover:bg-ink disabled:opacity-40"
            >
              {submitting ? "Sending…" : "Leave a wish"}
            </button>
          </form>
        )}

        <div className="mt-16 space-y-6">
          {loadState === "loading" && (
            <p className="text-center text-xs text-ink-muted">Loading wishes…</p>
          )}

          {loadState === "error" && (
            <p className="text-center text-xs text-ink-muted">
              The wishes couldn&apos;t be loaded just now.
            </p>
          )}

          {loadState === "ready" && messages.length === 0 && (
            <p className="text-center text-xs text-ink-muted">
              Be the first to leave a wish.
            </p>
          )}

          {messages.map((message) => (
            <figure
              key={message.id}
              className="rounded-sm border border-hairline bg-ivory px-6 py-5"
            >
              <blockquote className="font-display text-lg italic leading-relaxed text-burgundy">
                {message.body}
              </blockquote>
              <figcaption className="mt-3 text-[0.65rem] uppercase tracking-engraved text-ink-muted">
                {message.authorName}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
