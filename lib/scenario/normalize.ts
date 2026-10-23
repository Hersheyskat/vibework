import { LEVELS, PALETTE, type LevelId } from "@/lib/try/levels";
import type {
  Claim,
  Day,
  DayCharacter,
  LedgerEntry,
  ScenarioBundle,
  Task,
  Track,
  Trigger,
} from "./schema";

function ID(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function fixCond(c: unknown): void {
  if (!c || typeof c !== "object") return;
  const cond = c as Record<string, unknown>;
  const cal = cond.counter_at_least as
    | { counter?: string }
    | undefined;
  if (cal?.counter) {
    const [a, ...r] = String(cal.counter).split(".");
    cal.counter = ID(a) + "." + r.join(".").toLowerCase();
  }
  const ms = cond.messages_sent as { to?: string } | undefined;
  if (ms) ms.to = ID(ms.to);
  asArr(cond.all).forEach(fixCond);
  asArr(cond.any).forEach(fixCond);
}

/** Port of prototype normalize(). Mutates and returns a typed bundle, or null. */
export function normalize(
  raw: unknown,
  level: LevelId,
): ScenarioBundle | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const b = raw as Record<string, unknown>;
  const t = (b.track = asObj(b.track)) as unknown as Track;
  const d = (b.day = asObj(b.day)) as unknown as Day;

  t.cast = asArr(t.cast);
  d.characters = asArr(d.characters);

  t.cast.forEach((c, i) => {
    c.id = ID(c.id);
    c.color = PALETTE[i % PALETTE.length];
    c.initials = String(c.name || c.id)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("");
  });

  d.characters.forEach((c) => {
    c.id = ID(c.id);
    c.hidden_facts = asArr(c.hidden_facts).filter(
      (f) => f && (f as { fact?: string }).fact,
    ) as DayCharacter["hidden_facts"];
    if (c.limits && c.limits.data_pulls != null) {
      c.limits.data_pulls = LEVELS[level].pulls;
    }
    if (!Array.isArray(c.reply_flags)) delete c.reply_flags;
    if (c.available !== "locked") c.available = "start";
  });

  d.tasks = asArr(d.tasks);
  d.triggers = asArr(d.triggers);
  d.tasks.forEach((x) => {
    if (x.submit_to) x.submit_to = ID(x.submit_to);
    if (level !== "beginner") delete x.hint;
  });

  d.public = asObj(d.public) as Day["public"];
  for (const k of ["inbox", "reviews", "documents"] as const) {
    if (!Array.isArray(d.public[k])) d.public[k] = [];
  }
  const db = (d.public.dashboard = asObj(
    d.public.dashboard,
  ) as Day["public"]["dashboard"]);
  if (!Array.isArray(db.columns)) db.columns = [];
  if (!Array.isArray(db.rows)) db.rows = [];
  if (!Array.isArray(db.notes)) db.notes = [];

  d.group_chats = [];
  d.clock = (d.clock || { start: "09:00", end: "17:30", steps: [] }) as Day["clock"];
  if (!Array.isArray(d.clock.steps)) d.clock.steps = [];
  d.scoring = (d.scoring || {}) as Day["scoring"];
  d.scoring.expected_answers = d.scoring.expected_answers || {};

  b.ledger = asArr(b.ledger);
  b.claims = asArr(b.claims);

  d.tasks.forEach((x) => fixCond(x.done_when));
  d.clock.steps.forEach((s) => fixCond(s.when));
  d.triggers.forEach((tr) => {
    fixCond(tr.when);
    asArr(tr.do).forEach((a) => {
      if (!a || typeof a !== "object") return;
      const act = a as Record<string, unknown>;
      if (typeof act.unlock === "string") act.unlock = ID(act.unlock);
      const msg = act.message as { from?: string } | undefined;
      if (msg?.from) msg.from = ID(msg.from);
      const ai = act.ai_reply as { from?: string } | undefined;
      if (ai?.from) ai.from = ID(ai.from);
      if (typeof act.open === "string" && act.open.startsWith("chat:")) {
        act.open = "chat:" + ID(act.open.slice(5));
      }
    });
  });
  d.public.inbox.forEach((m) => {
    if (m) m.from = ID(m.from);
  });

  t.skills = asArr(t.skills);
  t.learning_library = t.learning_library || {};

  return {
    track: t,
    day: d,
    ledger: b.ledger as LedgerEntry[],
    claims: b.claims as Claim[],
  };
}

export function bossId(bundle: ScenarioBundle): string {
  const t = bundle.day.tasks.find((x) => x.kind === "submission");
  return t?.submit_to || bundle.day.characters[0]?.id || "";
}

export function castOf(bundle: ScenarioBundle, id: string) {
  return bundle.track.cast.find((c) => c.id === id);
}

export function charOf(bundle: ScenarioBundle, id: string) {
  return bundle.day.characters.find((c) => c.id === id);
}

export function toMin(t: string | undefined): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1;
}

export function idSlug(s: unknown): string {
  return ID(s);
}

export type { Task, Trigger };
