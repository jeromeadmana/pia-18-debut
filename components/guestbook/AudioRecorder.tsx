"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Record a short voice wish in the browser.
 *
 * Realities this has to survive:
 *
 *  - **iOS Safari produces MP4/AAC, not WebM.** So the mime type is picked by
 *    feature detection rather than hardcoded, and Cloudinary is told to store it
 *    as a `video` resource, which is how it handles audio.
 *  - **MediaRecorder is absent on older browsers**, so the whole control hides
 *    itself rather than rendering a button that throws on click.
 *  - **Permission is denied more often than people expect.** That path gets its
 *    own message, because "something went wrong" is useless when the fix is a
 *    browser setting.
 *  - The recording is capped and stopped automatically. An open-ended recorder
 *    on a phone in a pocket is how you get a 40-minute upload.
 *
 * The upload goes straight to Cloudinary using a server-signed ticket — see
 * /api/wishes/sign. The audio never passes through our own API.
 */

const MAX_SECONDS = 30;

/** Support never changes during a session, so there is nothing to subscribe to. */
function subscribeNever() {
  return () => {};
}

function getRecorderSupport(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/** Null on the server and during hydration — render a placeholder, not a guess. */
function getServerSupport(): boolean | null {
  return null;
}

type Phase = "idle" | "recording" | "review" | "uploading";

export type RecordedWish = { publicId: string; durationSec: number };

export function AudioRecorder({
  onRecorded,
  onClear,
  disabled,
}: {
  onRecorded: (wish: RecordedWish) => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  // Capability check, not state: MediaRecorder does not exist during SSR, so a
  // plain useState initialiser would either crash the server render or cause a
  // hydration mismatch. useSyncExternalStore's server snapshot handles both, and
  // avoids the cascading render that setState-in-an-effect would cause.
  const supported = useSyncExternalStore(
    subscribeNever,
    getRecorderSupport,
    getServerSupport,
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef = useRef<Blob | null>(null);

  // Release the microphone and the object URL on unmount. A live stream left
  // open keeps the browser's recording indicator lit, which is alarming.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (tickRef.current) clearInterval(tickRef.current);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function pickMimeType(): string | undefined {
    // Order matters: Safari only supports the mp4 variants.
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/aac",
    ];
    return candidates.find((t) => MediaRecorder.isTypeSupported(t));
  }

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType ?? "audio/webm",
        });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase("review");
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      setPhase("recording");
      setSeconds(0);

      tickRef.current = setInterval(() => {
        setSeconds((s) => {
          const next = s + 1;
          if (next >= MAX_SECONDS) stop();
          return next;
        });
      }, 1000);
    } catch (err) {
      const denied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "SecurityError");

      setError(
        denied
          ? "Microphone access was blocked. Allow it in your browser settings to record a wish."
          : "We couldn't start recording on this device.",
      );
      setPhase("idle");
    }
  }

  function stop() {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function discard() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setSeconds(0);
    setPhase("idle");
    onClear();
  }

  async function upload() {
    const blob = blobRef.current;
    if (!blob) return;

    setPhase("uploading");
    setError(null);

    try {
      const ticketResponse = await fetch("/api/wishes/sign", { method: "POST" });
      const ticketData = await ticketResponse.json();

      if (!ticketResponse.ok || !ticketData.ok) {
        setError(ticketData?.message ?? "Couldn't prepare the upload.");
        setPhase("review");
        return;
      }

      const t = ticketData.ticket;
      const form = new FormData();
      form.append("file", blob);
      form.append("api_key", t.apiKey);
      form.append("timestamp", String(t.timestamp));
      form.append("signature", t.signature);
      // Must match the signed values exactly or Cloudinary rejects the upload.
      form.append("folder", t.folder);
      form.append("public_id", t.publicId);

      const upload = await fetch(t.uploadUrl, { method: "POST", body: form });
      if (!upload.ok) {
        setError("The upload was refused. Please try again.");
        setPhase("review");
        return;
      }

      onRecorded({ publicId: t.publicId, durationSec: seconds });
      setPhase("review");
    } catch {
      setError("We couldn't reach the upload service.");
      setPhase("review");
    }
  }

  // Render nothing at all rather than a control that cannot work.
  if (supported === false) return null;
  if (supported === null) return <div className="h-20" aria-hidden />;

  return (
    <div className="rounded-sm border border-hairline p-4">
      <p className="text-[0.65rem] uppercase tracking-engraved text-accent">
        Or leave a voice wish
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {phase === "idle" && (
          <button
            type="button"
            disabled={disabled}
            onClick={start}
            className="min-h-11 rounded-full border border-hairline px-5 py-2 text-xs uppercase tracking-wide text-foreground transition hover:border-accent disabled:opacity-40"
          >
            ● Record
          </button>
        )}

        {phase === "recording" && (
          <>
            <button
              type="button"
              onClick={stop}
              className="min-h-11 rounded-full bg-rose px-5 py-2 text-xs uppercase tracking-wide text-white"
            >
              ■ Stop
            </button>
            <span
              className="text-xs tabular-nums text-muted"
              role="timer"
              aria-live="off"
            >
              {seconds}s / {MAX_SECONDS}s
            </span>
            <span
              aria-hidden
              className="h-2 w-2 animate-pulse rounded-full bg-rose"
            />
          </>
        )}

        {(phase === "review" || phase === "uploading") && previewUrl && (
          <>
            <audio src={previewUrl} controls className="h-9 max-w-full" />
            <button
              type="button"
              onClick={upload}
              disabled={phase === "uploading"}
              className="min-h-11 rounded-full bg-foreground px-5 py-2 text-xs uppercase tracking-wide text-background disabled:opacity-40"
            >
              {phase === "uploading" ? "Saving…" : "Use this"}
            </button>
            <button
              type="button"
              onClick={discard}
              className="text-xs uppercase tracking-wide text-muted underline-offset-4 hover:underline"
            >
              Discard
            </button>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className={cn("mt-3 text-xs text-rose")}>
          {error}
        </p>
      )}

      <p className="mt-3 text-[0.65rem] text-muted">
        Up to {MAX_SECONDS} seconds. Voice wishes are reviewed before they appear,
        the same as written ones.
      </p>
    </div>
  );
}
