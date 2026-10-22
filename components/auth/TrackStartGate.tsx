"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startDay } from "@/lib/client/api";
import { createClient } from "@/lib/supabase/client";
import { GoogleMark } from "@/components/auth/GoogleMark";

type Props = {
  trackId: string;
  learnerName: string | null;
  email: string | null;
};

function readResumeForTrack(trackId: string) {
  if (typeof window === "undefined") return null;
  const runId = localStorage.getItem("vw-run-id");
  const savedTrack = localStorage.getItem("vw-track-id");
  if (runId && savedTrack === trackId) return runId;
  return null;
}

export function TrackStartGate({ trackId, learnerName, email }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resumeRunId, setResumeRunId] = useState<string | null>(() =>
    readResumeForTrack(trackId),
  );
  const signedIn = Boolean(learnerName || email);

  function onGoogle() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const origin = window.location.origin;
      const next = `/tracks/${trackId}`;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oauthError) setError(oauthError.message);
    });
  }

  function onStart() {
    const name = (learnerName || email || "Learner").trim();
    setError(null);
    startTransition(async () => {
      try {
        if (resumeRunId) {
          router.push(`/play/${resumeRunId}`);
          return;
        }
        const payload = await startDay({
          trackId,
          day: 1,
          learnerName: name,
        });
        localStorage.setItem("vw-run-id", payload.runId);
        localStorage.setItem("vw-track-id", trackId);
        localStorage.setItem("vw-learner-name", name);
        setResumeRunId(payload.runId);
        router.push(`/play/${payload.runId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start");
      }
    });
  }

  if (!signedIn) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
        <p className="text-[13px] leading-relaxed text-white/55">
          Sign in with Google to start this scenario and keep your progress.
        </p>
        <button
          type="button"
          onClick={onGoogle}
          disabled={pending}
          className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3 text-[15px] font-semibold text-[#1f1f1f] transition hover:bg-white/90 disabled:opacity-50"
        >
          <GoogleMark />
          {pending ? "Redirecting…" : "Continue with Google"}
        </button>
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <p className="text-[13px] text-white/50">
        Signed in as{" "}
        <span className="font-medium text-white/80">
          {learnerName || email}
        </span>
      </p>
      <button
        type="button"
        onClick={onStart}
        disabled={pending}
        className="mt-4 flex w-full items-center justify-center rounded-xl bg-[var(--vw-accent)] px-4 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--vw-accent-deep)] disabled:opacity-50"
      >
        {pending
          ? "Opening workspace…"
          : resumeRunId
            ? "Continue day"
            : "Start Day 1"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
