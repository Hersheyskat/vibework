import type { ScenarioBundle } from "@/lib/scenario/schema";

export type ThreadMsg = {
  f: "me" | "them" | "sys";
  t: string;
  returned_data?: boolean;
  /** Data-URL thumbnails (screenshots); capped server-side. */
  imgs?: string[];
};

export type GameState = {
  view: string;
  seenInbox: boolean;
  sub: Record<string, string>;
  subHist: Record<string, string[]>;
  counters: Record<string, number>;
  fired: Record<string, boolean>;
  unlocked: Record<string, boolean>;
  threads: Record<string, ThreadMsg[]>;
  unread: Record<string, number>;
  drafts: Record<string, string>;
  tdraft: Record<string, string>;
  toast: string | null;
  nudged: boolean;
  revising: Record<string, boolean>;
  /** Queued AI replies to process after triggers (server drains). */
  replyQueue: { from: string; direction: string }[];
};

export type EngineCtx = {
  bundle: ScenarioBundle;
  state: GameState;
};

export function freshGameState(bundle: ScenarioBundle): GameState {
  const threads: Record<string, ThreadMsg[]> = {};
  const unread: Record<string, number> = {};
  const unlocked: Record<string, boolean> = {};

  for (const c of bundle.day.characters) {
    const open =
      c.opener && c.available !== "locked"
        ? [{ f: "them" as const, t: String(c.opener) }]
        : [];
    threads[c.id] = open;
    unread[c.id] = 0;
    if (c.available !== "locked") unlocked[c.id] = true;
  }
  threads.assist = [];
  threads.mentor = [];
  unread.assist = 0;
  unread.mentor = 0;

  return {
    view: "brief",
    seenInbox: false,
    sub: {},
    subHist: {},
    counters: {},
    fired: {},
    unlocked,
    threads,
    unread,
    drafts: {},
    tdraft: {},
    toast: null,
    nudged: false,
    revising: {},
    replyQueue: [],
  };
}
