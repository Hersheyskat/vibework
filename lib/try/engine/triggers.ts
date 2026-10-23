import { idSlug } from "@/lib/scenario/normalize";
import type { ScenarioBundle } from "@/lib/scenario/schema";
import { evalCond } from "./cond";
import type { GameState, ThreadMsg } from "./types";

function ensureThread(state: GameState, id: string) {
  if (!state.threads[id]) state.threads[id] = [];
  if (state.unread[id] == null) state.unread[id] = 0;
}

/** Run all newly-firing triggers. Mutates state. Returns fired trigger ids. */
export function runTriggers(
  state: GameState,
  bundle: ScenarioBundle,
): string[] {
  const fired: string[] = [];
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (const tr of bundle.day.triggers) {
      if (!tr.id || state.fired[tr.id] || !evalCond(tr.when, state, bundle))
        continue;
      state.fired[tr.id] = true;
      changed = true;
      fired.push(tr.id);
      for (const a of tr.do || []) {
        if (a.unlock) {
          state.unlocked[idSlug(a.unlock)] = true;
        } else if (a.message) {
          const f = idSlug(a.message.from);
          state.unlocked[f] = true;
          ensureThread(state, f);
          state.threads[f]!.push({
            f: "them",
            t: String(a.message.text || ""),
          });
          if (state.view !== `chat:${f}`) {
            state.unread[f] = (state.unread[f] || 0) + 1;
            state.toast = f;
          }
        } else if (a.open) {
          state.view = String(a.open);
          if (state.view.startsWith("chat:")) {
            const id = state.view.slice(5);
            state.unread[id] = 0;
            if (state.toast === id) state.toast = null;
          }
        } else if (a.ai_reply) {
          state.replyQueue.push({
            from: idSlug(a.ai_reply.from),
            direction: String(a.ai_reply.direction || ""),
          });
        }
      }
    }
  }
  return fired;
}

export function pushMessage(
  state: GameState,
  thread: string,
  msg: ThreadMsg,
) {
  ensureThread(state, thread);
  state.threads[thread]!.push(msg);
}

export function goView(state: GameState, view: string) {
  state.view = view;
  if (view.startsWith("chat:")) {
    const id = view.slice(5);
    state.unread[id] = 0;
    if (state.toast === id) state.toast = null;
  }
  if (view === "brief") state.seenInbox = true;
}
