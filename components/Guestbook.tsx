"use client";

import { useEffect, useState } from "react";
import { event } from "@/content/event.config";
import { cn } from "@/lib/utils";
import { AudioRecorder, type RecordedWish } from "./guestbook/AudioRecorder";

/**
 * The wishes wall.
 *
 * Fetched on the client rather than server-rendered, which is deliberate: it
 * keeps the home page fully prerendered — zero serverless invocations for every
 * guest who never scrolls this far — while the wall itself stays live.
 *
 * Everything posted lands unapproved, written and spoken alike. The copy says so
 * plainly rather than implying the message is already public, so nobody posts
 * twice thinking it failed.
 *
 * Cards use the surface's own glass tokens, so the same component reads
 * correctly on the obsidian ground it sits on here and on ivory if it moves.
 */

type Message = {
  id: number;
  authorName: string;
  body: string;
  audioPublicId: string | null;
  audioDurationSec: number | null;
  createdAt: string;
};

type LoadState = "loading" | "ready" | "error";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";

/** Mirrors `wishAudioUrl`; inlined so the client bundle skips the server module. */
function audioUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/pia-18-debut/wishes/${publicId}`;
}

export function Guestbook() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [wish, setWish] = useState<RecordedWish | null>(null);
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
  const hasContent = body.trim().length > 0 || wish !== null;

  async function handleSubmit(formEvent: React.FormEvent) {
    formEvent.preventDefault();
    setError(null);

    if (!authorName.trim()) return setError("Please add your name.");
    if (!hasContent) return setError("Please write a message or record a voice wish.");

    setSubmitting(true);
    try {
      const response = await fetch("/api/guestbook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: authorName.trim(),
          body: body.trim(),
          audioPublicId: wish?.publicId ?? null,
          audioDurationSec: wish?.durationSec ?? null,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data?.message ?? "Something went wrong. Please try again.");
        return;
      }

      setPosted(true);
      setAuthorName("");
      setBody("");
      setWish(null);
    } catch {
      setError("We couldn't reach the server. Please check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="surface-obsidian ambient-gold px-6 py-28">
      <div className="mx-auto max-w-2xl">
        <header className="text-center">
          <p className="text-[0.6rem] uppercase tracking-editorial text-accent">
            Guestbook
          </p>
          <h2 className="mt-3 font-display text-4xl font-extralight text-foreground">
            {event.guestbook.heading}
          </h2>
          <p className="mt-3 text-sm text-muted">{event.guestbook.prompt}</p>
        </header>

        {posted ? (
          <div
            role="status"
            className="glass mt-10 rounded-sm px-6 py-8 text-center text-sm text-foreground"
          >
            Thank you — your wish has been sent.
            <span className="mt-1 block text-xs text-muted">
              {event.guestbook.moderationNotice}
            </span>
            <button
              type="button"
              onClick={() => setPosted(false)}
              className="mt-4 text-xs uppercase tracking-wide text-accent underline-offset-4 hover:underline"
            >
              Leave another
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="glass mt-10 rounded-sm p-6">
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
              className="w-full rounded-sm border border-hairline bg-transparent px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
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
              className="mt-2 w-full resize-y rounded-sm border border-hairline bg-transparent px-4 py-3 text-sm text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent"
            />

            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted">
                {event.guestbook.moderationNotice}
              </span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  remaining < 40 ? "text-rose" : "text-muted",
                )}
              >
                {remaining}
              </span>
            </div>

            <div className="mt-5">
              <AudioRecorder
                disabled={submitting}
                onRecorded={setWish}
                onClear={() => setWish(null)}
              />
              {wish && (
                <p className="mt-2 text-xs text-accent">
                  Voice wish attached ({wish.durationSec}s). It will be sent with your
                  message.
                </p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="mt-4 rounded-sm border border-rose/40 bg-rose/10 px-4 py-3 text-sm text-foreground"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-5 min-h-12 w-full rounded-full bg-gold px-8 py-3 text-xs uppercase tracking-engraved text-obsidian transition hover:bg-champagne disabled:opacity-40"
            >
              {submitting ? "Sending…" : "Leave a wish"}
            </button>
          </form>
        )}

        <div className="mt-16 space-y-4">
          {loadState === "loading" && (
            <p className="text-center text-xs text-muted">Loading wishes…</p>
          )}
          {loadState === "error" && (
            <p className="text-center text-xs text-muted">
              The wishes couldn&apos;t be loaded just now.
            </p>
          )}
          {loadState === "ready" && messages.length === 0 && (
            <p className="text-center text-xs text-muted">
              Be the first to leave a wish.
            </p>
          )}

          {messages.map((message) => (
            <figure key={message.id} className="glass rounded-sm px-6 py-5">
              {message.body && (
                <blockquote className="font-display text-lg italic leading-relaxed text-foreground">
                  {message.body}
                </blockquote>
              )}

              {message.audioPublicId && CLOUD_NAME && (
                <div className={cn(message.body && "mt-4")}>
                  <audio
                    controls
                    preload="none"
                    src={audioUrl(message.audioPublicId)}
                    className="h-9 w-full"
                    aria-label={`Voice wish from ${message.authorName}`}
                  />
                </div>
              )}

              <figcaption className="mt-3 text-[0.6rem] uppercase tracking-editorial text-muted">
                {message.authorName}
                {message.audioPublicId && message.audioDurationSec
                  ? ` · ${message.audioDurationSec}s voice wish`
                  : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
