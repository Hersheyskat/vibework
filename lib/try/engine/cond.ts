import { idSlug } from "@/lib/scenario/normalize";
import type { ScenarioBundle, Task } from "@/lib/scenario/schema";
import type { GameState } from "./types";

export function evalCond(
  c: unknown,
  state: GameState,
  bundle: ScenarioBundle,
  depth = 0,
): boolean {
  if (!c || typeof c !== "object" || depth > 8) return false;
  const cond = c as Record<string, unknown>;

  if ("submitted" in cond) {
    return Boolean(state.sub[String(cond.submitted)]);
  }
  if ("task_done" in cond) {
    const t = bundle.day.tasks.find((x) => x.id === cond.task_done);
    return t ? taskDone(t, state, bundle, depth + 1) : false;
  }
  if (cond.counter_at_least) {
    const cal = cond.counter_at_least as { counter?: string; value?: number };
    return (state.counters[String(cal.counter)] || 0) >= Number(cal.value || 0);
  }
  if (cond.messages_sent) {
    const ms = cond.messages_sent as { to?: string; at_least?: number };
    const key = `${idSlug(ms.to)}.messages`;
    return (state.counters[key] || 0) >= Number(ms.at_least || 1);
  }
  if ("trigger_fired" in cond) {
    return Boolean(state.fired[String(cond.trigger_fired)]);
  }
  if (Array.isArray(cond.all)) {
    return cond.all.every((x) => evalCond(x, state, bundle, depth + 1));
  }
  if (Array.isArray(cond.any)) {
    return cond.any.some((x) => evalCond(x, state, bundle, depth + 1));
  }
  return false;
}

export function taskDone(
  t: Task,
  state: GameState,
  bundle: ScenarioBundle,
  depth = 0,
): boolean {
  if (t.kind === "submission" && !t.done_when) return Boolean(state.sub[t.id]);
  return evalCond(t.done_when, state, bundle, depth);
}

export function isAvail(
  id: string,
  state: GameState,
  bundle: ScenarioBundle,
): boolean {
  const c = bundle.day.characters.find((x) => x.id === id);
  if (!c) return false;
  return c.available !== "locked" || Boolean(state.unlocked[id]);
}

export function bossId(bundle: ScenarioBundle): string {
  const t = bundle.day.tasks.find((x) => x.kind === "submission");
  return t?.submit_to || bundle.day.characters[0]?.id || "";
}

export function infoId(bundle: ScenarioBundle): string | null {
  const c = bundle.day.characters.find((x) =>
    (x.reply_flags || []).includes("returned_data"),
  );
  return c?.id ?? null;
}

export function toMin(t: string | undefined): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}

export function fmtTime(t: string): string {
  const m = toMin(t);
  if (m < 0) return "09:00 AM";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${String(h12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${ap}`;
}

export function clockText(state: GameState, bundle: ScenarioBundle): string {
  const ck = bundle.day.clock || { start: "09:00", steps: [] };
  let t = ck.start || "09:00";
  for (const s of ck.steps || []) {
    if (evalCond(s.when, state, bundle) && toMin(s.time) > toMin(t)) {
      t = s.time || t;
    }
  }
  return fmtTime(t);
}

function chatTarget(t: Task): string | null {
  const w = (t.done_when || {}) as Record<string, unknown>;
  if (w.counter_at_least) {
    const cal = w.counter_at_least as { counter?: string };
    return String(cal.counter || "").split(".")[0] || null;
  }
  if (w.messages_sent) {
    const ms = w.messages_sent as { to?: string };
    return idSlug(ms.to);
  }
  return null;
}

export function nextStep(
  state: GameState,
  bundle: ScenarioBundle,
  opts?: { scored?: boolean; hasFeedback?: boolean },
): [string, string] {
  if (!state.seenInbox)
    return ["Read your welcome email in the Inbox.", "brief"];
  const un = bundle.day.characters
    .map((c) => c.id)
    .find((k) => (state.unread[k] || 0) > 0);
  if (un) {
    const name =
      bundle.track.cast.find((c) => c.id === un)?.name?.split(" ")[0] || un;
    return [`${name} sent you a message. Read it.`, `chat:${un}`];
  }
  for (const t of bundle.day.tasks) {
    if (taskDone(t, state, bundle)) continue;
    if (t.kind === "submission")
      return [`${t.title}: write it on the Tasks page.`, "tasks"];
    const to = chatTarget(t);
    if (to && isAvail(to, state, bundle)) {
      const name =
        bundle.track.cast.find((c) => c.id === to)?.name?.split(" ")[0] || to;
      return [`${t.title}. Message ${name}.`, `chat:${to}`];
    }
  }
  if (bundle.day.tasks.some((t) => !taskDone(t, state, bundle))) {
    const src = infoId(bundle);
    const name = src
      ? bundle.track.cast.find((c) => c.id === src)?.name?.split(" ")[0] || src
      : "a colleague";
    return [
      `Keep working: ask ${name} another question, or check in with a colleague.`,
      src ? `chat:${src}` : "tasks",
    ];
  }
  if (!opts?.hasFeedback && !opts?.scored) {
    return ["Your day is done. Get your practice score.", "feedback"];
  }
  const mentorName =
    bundle.track.mentor?.name?.split(" ")[0] || "your mentor";
  const asked = (state.threads.mentor || []).some((m) =>
    /end-of-day debrief|give me my debrief/i.test(m.t),
  );
  if (!asked) {
    return [`Get your debrief from ${mentorName}.`, "chat:mentor"];
  }
  return ["Review your score, replay the day, or try another job.", "feedback"];
}
