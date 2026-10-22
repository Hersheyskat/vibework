import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { ChatMessage, DayRunState } from "@/lib/scenarios/types";
import { loadDay } from "@/lib/scenarios/load";

const DATA_DIR = path.join(process.cwd(), ".data", "runs");

function ensureDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function runPath(id: string) {
  return path.join(DATA_DIR, `${id}.json`);
}

export function createDayRun(opts: {
  trackId: string;
  day: number;
  learnerName: string;
}): DayRunState {
  ensureDir();
  const day = loadDay(opts.trackId, opts.day);
  const now = new Date().toISOString();
  const unlocked = [
    ...day.characters.filter((c) => c.available === "start").map((c) => c.id),
    ...day.group_chats.filter((g) => g.available === "start").map((g) => g.id),
    "saathi",
  ];

  const messages: ChatMessage[] = [];
  for (const ch of day.characters) {
    if (ch.available === "start" && ch.opener) {
      messages.push({
        id: randomUUID(),
        thread: ch.id,
        sender: ch.id,
        text: ch.opener,
        createdAt: now,
      });
    }
  }
  for (const g of day.group_chats) {
    if (g.available === "start" && g.opener) {
      messages.push({
        id: randomUUID(),
        thread: g.id,
        sender: "system",
        text: g.opener,
        createdAt: now,
        system: true,
      });
    }
  }

  const run: DayRunState = {
    id: randomUUID(),
    trackId: opts.trackId,
    day: opts.day,
    scenarioVersion: day.version,
    learnerName: opts.learnerName.trim() || "Learner",
    unlocked,
    counters: {},
    triggersFired: [],
    tasksDone: [],
    submissions: {},
    messages,
    threadSummaries: {},
    openHint: null,
    createdAt: now,
    updatedAt: now,
  };

  saveDayRun(run);
  return run;
}

export function getDayRun(id: string): DayRunState | null {
  ensureDir();
  const file = runPath(id);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as DayRunState;
}

export function saveDayRun(run: DayRunState) {
  ensureDir();
  run.updatedAt = new Date().toISOString();
  writeFileSync(runPath(run.id), JSON.stringify(run, null, 2));
}

export function listRecentRuns(limit = 20): DayRunState[] {
  ensureDir();
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".json"));
  const runs = files
    .map((f) => {
      try {
        return JSON.parse(
          readFileSync(path.join(DATA_DIR, f), "utf8"),
        ) as DayRunState;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as DayRunState[];
  return runs
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}
