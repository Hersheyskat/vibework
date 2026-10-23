"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LEVELS, type LevelId } from "@/lib/try/levels";

type Check = {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
};

type RunState = {
  id: string;
  status: string;
  currentStep: string | null;
  level: LevelId;
  regulationBanner: string | null;
  adjacentRoles: string[];
  screen: {
    role_title: string;
    industry: string;
    regulation: string;
    reason: string;
  } | null;
  summary: {
    company: { name: string; one_liner: string };
    role: string;
    boss: { id?: string; name?: string } | null;
    team: { id: string; name: string; role: string; cares_about: string; color?: string; initials?: string }[];
  } | null;
  gen: {
    status: string;
    step: string;
    attempt: number;
    mode?: string;
    checks: Check[];
    err: string | null;
    structural?: boolean;
  } | null;
};

function stepClass(
  key: "screen" | "plan" | "check",
  gen: RunState["gen"],
  status: string,
): string {
  if (!gen) return "";
  const order = ["screen", "plan", "check", "ready"] as const;
  const curKey =
    gen.step === "repair"
      ? "plan"
      : gen.step === "blocked"
        ? "screen"
        : gen.step === "failed"
          ? "check"
          : gen.step;
  const cur = order.indexOf(curKey as (typeof order)[number]);
  const i = order.indexOf(key);
  if (status === "failed" && i === cur) return "bad";
  if (status === "ready" || status === "blocked" || i < cur) return "ok";
  if (i === cur && (gen.status === "running" || status === "checking" || status === "planning" || status === "repairing" || status === "screening"))
    return "run";
  return "";
}

function ic(s: string, n: number) {
  if (s === "ok") return "✓";
  if (s === "bad") return "✕";
  return String(n);
}

export function BuildingScreen({
  runId,
  inputPreview,
}: {
  runId: string;
  inputPreview: string;
}) {
  const router = useRouter();
  const [run, setRun] = useState<RunState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  async function startDay() {
    if (starting) return;
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/games`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        gameId?: string;
        error?: string;
      };
      if (!res.ok || !body.gameId) {
        throw new Error(body.error || "Could not start the day");
      }
      router.push(`/games/${body.gameId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the day");
      setStarting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let polls = 0;
    const MAX_POLLS = 80; // ~4 min at 3s
    const INTERVAL_MS = 3000;

    async function poll() {
      if (cancelled) return;
      polls += 1;
      try {
        const res = await fetch(`/api/runs/${runId}?tester=1`);
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          if (!cancelled)
            setError(body.error || `Failed to load run (${res.status})`);
          return;
        }
        const data = (await res.json()) as RunState;
        if (!cancelled) setRun(data);
        const done =
          data.status === "ready" ||
          data.status === "failed" ||
          data.status === "blocked" ||
          data.gen?.status === "failed" ||
          data.gen?.status === "done";
        if (done || cancelled) return;
        if (polls >= MAX_POLLS) {
          if (!cancelled)
            setError(
              "This is taking too long. Try again with a shorter job post.",
            );
          return;
        }
        timer = setTimeout(poll, INTERVAL_MS);
      } catch {
        if (!cancelled && polls < MAX_POLLS) {
          timer = setTimeout(poll, INTERVAL_MS);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [runId]);

  if (error) {
    return (
      <div className="pane">
        <h1>Building your work-day</h1>
        <p className="note">{error}</p>
        <Link className="btn ghost" href="/">
          Change the job
        </Link>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="pane">
        <h1>Building your work-day</h1>
        <p className="sub">
          Starting<span className="dots">…</span>
        </p>
      </div>
    );
  }

  if (run.status === "blocked") {
    return (
      <BlockedInner
        roleTitle={run.screen?.role_title || "This role"}
        reason={run.screen?.reason || ""}
        adjacent={run.adjacentRoles}
      />
    );
  }

  const gen = run.gen;
  const s1 = stepClass("screen", gen, run.status);
  const s2 = stepClass("plan", gen, run.status);
  const s3 = stepClass("check", gen, run.status);
  const levelLabel = LEVELS[run.level]?.label || run.level;

  return (
    <div className="pane">
      <h1>Building your work-day</h1>
      <p className="sub">
        {inputPreview.length > 140
          ? inputPreview.slice(0, 140) + "…"
          : inputPreview}{" "}
        · {levelLabel}
      </p>

      {run.regulationBanner || run.screen?.regulation === "flag" ? (
        <div className="flag">
          <b>Regulated area.</b>{" "}
          {run.regulationBanner ||
            run.screen?.reason ||
            "This practice day covers the workplace side of the job."}
        </div>
      ) : null}

      <div className="steps">
        <div className={`step ${s1}`}>
          <span className="ic">{ic(s1, 1)}</span>
          <div>
            <b>Reading the job</b>
            <span className="hint">
              {run.screen
                ? `${run.screen.role_title} · ${run.screen.industry}`
                : "Working out the role and checking it isn't a licensed profession…"}
            </span>
          </div>
        </div>
        <div className={`step ${s2}`}>
          <span className="ic">{ic(s2, 2)}</span>
          <div>
            <b>
              {(gen?.attempt || 0) > 1
                ? gen?.mode === "repair"
                  ? "Fixing the issues found"
                  : "Planning the day (second attempt)"
                : "Planning the day"}
            </b>
            <span className="hint">
              {s2 === "bad"
                ? gen?.err || "Planning failed."
                : s2 === "run"
                  ? "Writing the company, people, inbox, data and hidden facts…"
                  : s2 === "ok"
                    ? "Plan written"
                    : "Waiting"}
              {s2 === "run" ? <span className="dots">…</span> : null}
            </span>
          </div>
        </div>
        <div className={`step ${s3}`}>
          <span className="ic">{ic(s3, 3)}</span>
          <div>
            <b>Checking the plan</b>
            <span className="hint">
              {s3 === "run"
                ? "Running automatic checks, then an AI review"
                : s3 === ""
                  ? "Waiting"
                  : ""}
              {s3 === "run" ? <span className="dots">…</span> : null}
            </span>
            <div className="checks">
              {(gen?.checks || []).map((c) => (
                <div className="ck" key={c.name}>
                  <span className={`pill ${c.status}`}>{c.status}</span>
                  <div>
                    {c.name}
                    <small>{c.detail}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {run.status === "ready" && run.summary ? (
        <div className="ready">
          <h2>Your day is ready</h2>
          <p style={{ margin: "0 0 6px" }}>
            You&apos;re joining <b>{run.summary.company.name}</b> as{" "}
            <b>{run.summary.role}</b>. {run.summary.company.one_liner}
          </p>
          <p className="hint" style={{ margin: "0 0 12px" }}>
            Boss: {run.summary.boss?.name || "—"} · Team:{" "}
            {run.summary.team
              .filter((t) => t.id !== run.summary?.boss?.id)
              .map((t) => t.name.split(" ")[0])
              .join(", ")}{" "}
            · {levelLabel}
          </p>
          <ul className="team-list">
            {run.summary.team.map((t) => (
              <li key={t.id}>
                <span
                  className="av"
                  style={{ background: t.color || "#555" }}
                >
                  {t.initials}
                </span>
                <span>
                  <b>{t.name}</b>
                  <small style={{ display: "block", color: "var(--muted)" }}>
                    {t.role}
                    {t.cares_about ? ` · ${t.cares_about}` : ""}
                  </small>
                </span>
              </li>
            ))}
          </ul>
          <div className="row" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn"
              disabled={starting}
              onClick={() => void startDay()}
            >
              {starting ? "Starting…" : "Start your day"}
            </button>
            {error ? <span className="hint" style={{ color: "var(--bad)" }}>{error}</span> : null}
          </div>
        </div>
      ) : null}

      {run.status === "failed" ? (
        <div className="empty" style={{ marginTop: 16 }}>
          <h2>The plan didn&apos;t pass</h2>
          <p>{gen?.err || "Checks failed after repair."}</p>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => router.push("/")}
            >
              Try again
            </button>
            <Link className="btn ghost" href="/">
              Change the job
            </Link>
          </div>
        </div>
      ) : null}

      {gen?.status === "running" &&
      run.status !== "ready" &&
      run.status !== "failed" ? (
        <div className="row" style={{ marginTop: 14 }}>
          <span className="hint">
            You can leave this tab open; it finishes on its own.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function BlockedInner({
  roleTitle,
  reason,
  adjacent,
}: {
  roleTitle: string;
  reason: string;
  adjacent: string[];
}) {
  const router = useRouter();
  return (
    <div className="pane">
      <h1>We don&apos;t simulate this role</h1>
      <p className="sub">
        <b>{roleTitle}</b> is licensed professional practice. {reason}
      </p>
      <div className="flag">
        A practice game can teach the wrong habits for clinical, legal or
        aviation decisions, and nobody should treat its feedback as professional
        guidance. Real training for these roles needs accredited programmes and
        supervised practice.
      </div>
      <h2>Try a nearby role instead</h2>
      <div className="chips">
        {adjacent.slice(0, 4).map((r) => (
          <button
            key={r}
            type="button"
            className="btn ghost"
            onClick={() => {
              sessionStorage.setItem("vw-try-prefill", r);
              router.push("/");
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 22 }}>
        <Link className="btn ghost" href="/">
          Change the job
        </Link>
      </div>
    </div>
  );
}
