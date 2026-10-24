"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { GoogleSignInButton } from "@/components/try/GoogleSignInButton";
import { guardJobInput } from "@/lib/try/guard";
import {
  EXAMPLE_ROLES,
  LEVELS,
  type LevelId,
  JOB_INPUT_MAX,
} from "@/lib/try/levels";

const SAMPLE_JOB = `Product Manager — Zippy Café (fictional)

We're looking for a Product Manager to own Zippy Café, our 10-minute grocery delivery company's new food vertical. You'll diagnose why only 14% of first-time Café customers reorder (target 30%), work with data, ops and growth, and ship a clear recommendation in three weeks.`;

type Props = {
  signedIn: boolean;
  learnerLabel: string | null;
};

type AllowanceInfo = {
  remainingToday: number;
  remainingMonth: number;
  daysPerDay: number;
  daysPerMonth: number;
  ok: boolean;
  reason: string | null;
};

export function SetupScreen({ signedIn, learnerLabel }: Props) {
  const router = useRouter();
  const [input, setInput] = useState(SAMPLE_JOB);
  const [level, setLevel] = useState<LevelId>("medium");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [allowance, setAllowance] = useState<AllowanceInfo | null>(null);
  const [budgetPaused, setBudgetPaused] = useState(false);

  useEffect(() => {
    const pre = sessionStorage.getItem("vw-try-prefill");
    if (pre) {
      setInput(pre);
      sessionStorage.removeItem("vw-try-prefill");
    }
  }, []);

  useEffect(() => {
    if (!signedIn) {
      setAllowance(null);
      return;
    }
    let cancelled = false;
    void fetch("/api/me/allowance")
      .then((r) => r.json())
      .then(
        (body: {
          allowance?: AllowanceInfo;
          budgetPaused?: boolean;
          budgetReason?: string;
        }) => {
          if (cancelled) return;
          if (body.allowance) setAllowance(body.allowance);
          setBudgetPaused(Boolean(body.budgetPaused));
          if (body.budgetPaused && body.budgetReason) {
            setError(body.budgetReason);
          }
        },
      )
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const charHint = useMemo(() => {
    if (input.length <= JOB_INPUT_MAX) return null;
    return `Trimmed to ${JOB_INPUT_MAX.toLocaleString()} characters when you build.`;
  }, [input.length]);

  function pickExample(role: string) {
    setInput(role);
    setError(null);
  }

  function onBuild() {
    const result = guardJobInput(input);
    if (!result.ok) {
      setError(
        result.reason === "empty"
          ? "Paste a job post or type a role first."
          : "Paste the job description, not just a link. Job sites need a login, so we can't fetch the page.",
      );
      return;
    }
    setError(null);
    if (!signedIn) {
      setError("Sign in with Google first — then we'll build your day.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: result.text, level }),
        });
        const body = (await res.json()) as { id?: string; error?: string };
        if (!res.ok || !body.id) {
          setError(body.error || "Could not start generation");
          return;
        }
        router.push(`/runs/${body.id}`);
      } catch {
        setError("Could not start generation. Check your connection.");
      }
    });
  }

  return (
    <div className="pane">
      {!signedIn ? (
        <div className="auth-banner">
          <p>
            Sign in to build a practice day. We use Google so we can cap AI cost
            per person.
          </p>
          <GoogleSignInButton next="/" />
        </div>
      ) : (
        <div className="auth-banner">
          <p>
            Signed in as <strong>{learnerLabel ?? "you"}</strong>
            {allowance ? (
              <>
                {" "}
                ·{" "}
                <span className="hint">
                  {allowance.remainingToday} of {allowance.daysPerDay} free
                  builds left today · {allowance.remainingMonth} of{" "}
                  {allowance.daysPerMonth} this month
                </span>
              </>
            ) : null}
          </p>
        </div>
      )}

      <div className="hero">
        <div className="kick">VibeWork Try · practice mode</div>
        <h1>Vibe check any job</h1>
        <p className="sub">
          Paste a job post or type a role. We&apos;ll build one realistic
          work-day at a fictional company, with a boss, colleagues, data and a
          mid-day twist. Then you do the job and get coached.
        </p>
      </div>

      <div className="field">
        <label htmlFor="jobin">The job</label>
        <textarea
          id="jobin"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError(null);
          }}
          placeholder="Paste a job post, or type a role like “Retail Store Manager”"
        />
        <div className="chips" aria-label="Example roles">
          {EXAMPLE_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              className="useb"
              onClick={() => pickExample(role)}
            >
              {role}
            </button>
          ))}
        </div>
        {charHint ? <p className="hint">{charHint}</p> : null}
        {error ? <p className="note">{error}</p> : null}
      </div>

      <h2>Pick your level</h2>
      <div className="levels" role="group" aria-label="Difficulty level">
        {(Object.keys(LEVELS) as LevelId[]).map((id) => (
          <button
            key={id}
            type="button"
            className="lvl"
            aria-pressed={level === id}
            onClick={() => setLevel(id)}
          >
            <b>{LEVELS[id].label}</b>
            <span>{LEVELS[id].blurb}</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ marginTop: 22 }}>
        <button
          type="button"
          className="btn"
          onClick={onBuild}
          disabled={
            pending ||
            budgetPaused ||
            Boolean(allowance && !allowance.ok)
          }
        >
          {pending ? "Starting…" : "Build my work-day"}
        </button>
        <span className="hint">
          Takes 1–2 minutes. Uses OpenRouter on the server.
        </span>
      </div>

      <div className="flow">
        <div>
          <b>Plan</b>
          AI writes the company, people, data, hidden facts and a twist.
        </div>
        <div>
          <b>Check</b>
          Automatic checks on format, numbers and real brands; one redo if it
          fails.
        </div>
        <div>
          <b>Play</b>
          Inbox, dashboard, chats, Saathi and a mentor; a practice score at the
          end.
        </div>
      </div>

      <p className="fineprint">
        Licensed roles (doctors, nurses, lawyers, pilots, armed security)
        aren&apos;t simulated. Scores are practice feedback, not certification.
        Job text and chats are stored to improve the product; you can ask us to
        delete them.
      </p>
    </div>
  );
}
