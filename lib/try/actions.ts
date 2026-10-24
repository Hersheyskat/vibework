import { idSlug } from "@/lib/scenario/normalize";
import { infoId, isAvail } from "@/lib/try/engine/cond";
import { goView, pushMessage, runTriggers } from "@/lib/try/engine/triggers";
import type { GameState } from "@/lib/try/engine/types";
import { drainReplyQueue, generateCharacterReply } from "@/lib/try/reply";
import type { ScenarioBundle } from "@/lib/scenario/schema";

export function applyView(state: GameState, view: string) {
  goView(state, view);
}

export function applyDraft(
  state: GameState,
  key: string,
  text: string,
) {
  if (key.startsWith("task:")) {
    const id = key.slice(5);
    if (text) state.tdraft[id] = text;
    else delete state.tdraft[id];
    return;
  }
  if (text) state.drafts[key] = text;
  else delete state.drafts[key];
}

export function chatLockReason(
  state: GameState,
  bundle: ScenarioBundle,
  id: string,
): string | null {
  if (id === "assist" || id === "mentor") return null;
  if (!isAvail(id, state, bundle)) {
    const name =
      bundle.track.cast.find((c) => c.id === id)?.name?.split(" ")[0] || id;
    return `${name} hasn't messaged you.`;
  }
  const c = bundle.day.characters.find((x) => x.id === id);
  if (!c) return "Unknown contact.";
  const pullLimit = c.limits?.data_pulls;
  const pulls = state.counters[`${id}.data_pulls`] || 0;
  if (pullLimit != null && pulls >= pullLimit) {
    const name =
      bundle.track.cast.find((x) => x.id === id)?.name?.split(" ")[0] || id;
    return `${name} has used all ${pullLimit} data pulls for today.`;
  }
  const qLimit = c.limits?.questions;
  const msgs = state.counters[`${id}.messages`] || 0;
  if (qLimit != null && msgs >= qLimit) {
    const name =
      bundle.track.cast.find((x) => x.id === id)?.name?.split(" ")[0] || id;
    return `${name} has had to go.`;
  }
  return null;
}

/** Player sends a chat message. Mutates state; caller saves + drains AI. */
export function applyPlayerMessage(
  state: GameState,
  bundle: ScenarioBundle,
  to: string,
  text: string,
  images?: string[],
): { ok: true } | { ok: false; error: string } {
  const imgs = (images || []).filter(
    (u) => typeof u === "string" && u.startsWith("data:image/"),
  ).slice(0, 2);
  const trimmed = text.trim() || (imgs.length ? "(see screenshot)" : "");
  if (!trimmed) return { ok: false, error: "Empty message" };
  const lock = chatLockReason(state, bundle, to);
  if (lock) return { ok: false, error: lock };

  goView(state, `chat:${to}`);
  pushMessage(state, to, {
    f: "me",
    t: trimmed,
    imgs: imgs.length ? imgs : undefined,
  });
  state.counters[`${to}.messages`] =
    (state.counters[`${to}.messages`] || 0) + 1;
  delete state.drafts[to];
  runTriggers(state, bundle);
  return { ok: true };
}

export async function generateAndAppendReply(opts: {
  state: GameState;
  bundle: ScenarioBundle;
  characterId: string;
  direction?: string;
  gameId: string;
  runId?: string;
}): Promise<string> {
  const { text, returnedData } = await generateCharacterReply({
    bundle: opts.bundle,
    state: opts.state,
    characterId: opts.characterId,
    direction: opts.direction,
    gameId: opts.gameId,
    runId: opts.runId,
  });
  pushMessage(opts.state, opts.characterId, {
    f: "them",
    t: text,
    returned_data: returnedData || undefined,
  });
  if (returnedData) {
    const key = `${opts.characterId}.data_pulls`;
    opts.state.counters[key] = (opts.state.counters[key] || 0) + 1;
  }
  if (opts.state.view !== `chat:${opts.characterId}`) {
    opts.state.unread[opts.characterId] =
      (opts.state.unread[opts.characterId] || 0) + 1;
    opts.state.toast = opts.characterId;
  }
  runTriggers(opts.state, opts.bundle);
  return text;
}

export async function afterPlayerMessage(opts: {
  state: GameState;
  bundle: ScenarioBundle;
  to: string;
  gameId: string;
  runId?: string;
}): Promise<string> {
  const replyText = await generateAndAppendReply({
    state: opts.state,
    bundle: opts.bundle,
    characterId: opts.to,
    gameId: opts.gameId,
    runId: opts.runId,
  });
  await drainReplyQueue({
    bundle: opts.bundle,
    state: opts.state,
    gameId: opts.gameId,
    runId: opts.runId,
  });
  return replyText;
}

export function applySubmission(
  state: GameState,
  bundle: ScenarioBundle,
  taskId: string,
  text: string,
): { ok: true; submitTo: string } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed.length < 40) {
    return {
      ok: false,
      error: "Write a bit more: give your reasoning and evidence.",
    };
  }
  const task = bundle.day.tasks.find((t) => t.id === taskId);
  if (!task || task.kind !== "submission") {
    return { ok: false, error: "Not a submission task" };
  }
  if (state.sub[taskId]) {
    return { ok: false, error: "Already submitted; use revise" };
  }
  const to = idSlug(task.submit_to);
  if (!to) return { ok: false, error: "Task has no submit_to" };
  state.sub[taskId] = trimmed;
  delete state.tdraft[taskId];
  pushMessage(state, to, { f: "me", t: `${task.title}:\n${trimmed}` });
  const fired = runTriggers(state, bundle);
  const replied = fired.some((tid) => {
    const tr = bundle.day.triggers.find((t) => t.id === tid);
    return (tr?.do || []).some(
      (a) => a.ai_reply && idSlug(a.ai_reply.from) === to,
    );
  });
  if (!replied) {
    goView(state, `chat:${to}`);
    state.replyQueue.push({
      from: to,
      direction: `The player just submitted "${task.title}". React in 2–3 lines, in character: push on the weakest point.`,
    });
  }
  if (!state.nudged) {
    state.nudged = true;
    state.replyQueue.push({
      from: "mentor",
      direction:
        "Send one short unprompted coaching note (3–4 lines) on how the player approached their first submission: one thing done well, one working habit to build next. Never reveal answers, hidden facts or what colleagues know.",
    });
  }
  return { ok: true, submitTo: to };
}

export function applyRevision(
  state: GameState,
  bundle: ScenarioBundle,
  taskId: string,
  text: string,
): { ok: true; submitTo: string } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (trimmed.length < 40) {
    return { ok: false, error: "Write a bit more." };
  }
  const task = bundle.day.tasks.find((t) => t.id === taskId);
  if (!task || task.kind !== "submission") {
    return { ok: false, error: "Not a submission task" };
  }
  const prev = state.sub[taskId];
  if (!prev) return { ok: false, error: "Submit first" };
  if (trimmed === prev) {
    return { ok: false, error: "Nothing has changed yet." };
  }
  const hist = state.subHist[taskId] || [];
  if (hist.length >= 2) {
    return { ok: false, error: "No revisions left" };
  }
  hist.push(prev);
  state.subHist[taskId] = hist;
  state.sub[taskId] = trimmed;
  delete state.tdraft[taskId];
  delete state.revising[taskId];
  const to = idSlug(task.submit_to);
  if (!to) return { ok: false, error: "Task has no submit_to" };
  pushMessage(state, to, {
    f: "me",
    t: `${task.title} (revised):\n${trimmed}`,
  });
  state.replyQueue.push({
    from: to,
    direction: `The player sent a revised "${task.title}" that folds in feedback. If it is broadly right, accept it: one line on what is now good, at most one small optional point, and close the loop. Do not ask for another round or add any new hurdle.`,
  });
  goView(state, `chat:${to}`);
  return { ok: true, submitTo: to };
}

export function setRevising(state: GameState, taskId: string, on: boolean) {
  if (on) state.revising[taskId] = true;
  else delete state.revising[taskId];
}

export { infoId };
