"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startDay } from "@/lib/client/api";
import { createClient } from "@/lib/supabase/client";

type Props = {
  learnerName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

function readResumeRunId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("vw-run-id");
}

export function HomeGate({ learnerName, email, avatarUrl }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resumeRunId, setResumeRunId] = useState<string | null>(readResumeRunId);
  const signedIn = Boolean(learnerName || email);

  function onGoogle() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
      }
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
          trackId: "zippy-pm",
          day: 1,
          learnerName: name,
        });
        localStorage.setItem("vw-run-id", payload.runId);
        localStorage.setItem("vw-learner-name", name);
        setResumeRunId(payload.runId);
        router.push(`/play/${payload.runId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not start");
      }
    });
  }

  function onSignOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      localStorage.removeItem("vw-run-id");
      localStorage.removeItem("vw-learner-name");
      router.refresh();
    });
  }

  return (
    <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
      {signedIn ? (
        <>
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-10 w-10 rounded-full border border-white/15"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                {(learnerName || email || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-[15px] font-medium">
                {learnerName || "Learner"}
              </div>
              {email ? (
                <div className="truncate text-xs text-white/45">{email}</div>
              ) : null}
            </div>
          </div>
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
          <button
            type="button"
            onClick={onSignOut}
            disabled={pending}
            className="mt-3 w-full text-center text-[12px] text-white/40 hover:text-white/70"
          >
            Sign out
          </button>
        </>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-white/55">
            Sign in with Google to save progress and enter the Zippy workspace.
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
          <p className="mt-3 text-center text-[12px] text-white/35">
            Google login only — no OTP or password.
          </p>
        </>
      )}
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
