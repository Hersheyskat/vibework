"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEVELS, type LevelId } from "@/lib/try/levels";

type DayItem = {
  runId: string;
  gameId: string | null;
  level: string;
  runStatus: string;
  gameStatus: string | null;
  company: string | null;
  role: string | null;
  inputPreview: string;
  createdAt: string;
  href: string;
  actionLabel: string;
};

type StatusTone = "ok" | "run" | "warn" | "bad" | "muted";

function statusMeta(item: DayItem): { label: string; tone: StatusTone } {
  if (item.gameStatus === "scored") return { label: "Scored", tone: "ok" };
  if (item.gameStatus === "playing")
    return { label: "In progress", tone: "run" };
  if (item.runStatus === "ready") return { label: "Ready", tone: "ok" };
  if (item.runStatus === "failed") return { label: "Didn't pass", tone: "bad" };
  if (item.runStatus === "blocked") return { label: "Blocked", tone: "warn" };
  if (
    item.runStatus === "planning" ||
    item.runStatus === "checking" ||
    item.runStatus === "repairing" ||
    item.runStatus === "screening" ||
    item.runStatus === "guarding"
  ) {
    return { label: "Building", tone: "run" };
  }
  return { label: item.runStatus, tone: "muted" };
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function initials(item: DayItem): string {
  const src = item.company || item.role || "Day";
  const parts = src.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      (parts[0]![0] || "") + (parts[1]![0] || "")
    ).toUpperCase();
  }
  return src.slice(0, 2).toUpperCase();
}

export function MyDaysScreen() {
  const [items, setItems] = useState<DayItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me/games")
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          items?: DayItem[];
          error?: string;
        };
        if (!res.ok) throw new Error(body.error || "Could not load your days");
        if (!cancelled) setItems(body.items || []);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Could not load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pane my-days">
      <div className="hero">
        <div className="kick">Your library</div>
        <h1>My days</h1>
        <p className="sub">
          Practice days you&apos;ve built. Resume one, or start a new job.
        </p>
      </div>

      {error ? (
        <div className="empty">
          <h2>Couldn&apos;t load</h2>
          <p>{error}</p>
          <div className="row">
            <button
              type="button"
              className="btn"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {items === null && !error ? (
        <div className="day-list">
          <div className="day-card day-card-skel" aria-hidden>
            <div className="day-av" />
            <div className="day-card-main">
              <b>Loading…</b>
              <small>Fetching your practice days</small>
            </div>
          </div>
        </div>
      ) : null}

      {items && items.length === 0 ? (
        <div className="empty">
          <h2>No days yet</h2>
          <p>
            Paste a job on the home screen and build your first practice day.
          </p>
          <div className="row">
            <Link className="btn" href="/">
              Build a day
            </Link>
          </div>
        </div>
      ) : null}

      {items && items.length > 0 ? (
        <>
          <div className="my-days-toolbar">
            <span className="hint">
              {items.length} day{items.length === 1 ? "" : "s"}
            </span>
            <Link className="btn ghost" href="/">
              Try another job
            </Link>
          </div>
          <ul className="day-list">
            {items.map((item) => {
              const levelLabel =
                LEVELS[item.level as LevelId]?.label || item.level;
              const status = statusMeta(item);
              const title =
                item.role && item.company
                  ? item.role
                  : item.role || item.company || "Practice day";
              const subtitle =
                item.company ||
                (item.role ? item.inputPreview : null) ||
                item.inputPreview;

              return (
                <li key={item.runId} className="day-card">
                  <span className="day-av" aria-hidden>
                    {initials(item)}
                  </span>
                  <div className="day-card-main">
                    <div className="day-card-title">
                      <b>{title}</b>
                      <span className={`day-pill ${status.tone}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="day-company">{subtitle}</p>
                    <small>
                      {levelLabel} · {formatWhen(item.createdAt)}
                    </small>
                  </div>
                  <Link className="btn" href={item.href}>
                    {item.actionLabel}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
