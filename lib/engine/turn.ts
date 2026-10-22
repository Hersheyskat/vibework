import { randomUUID } from "crypto";
import {
  chatCompletion,
  mockCharacterReply,
  openRouterConfigured,
} from "@/lib/ai/openrouter";
import { getCastMap, loadDay, loadTrack } from "@/lib/scenarios/load";
import type {
  Action,
  ChatMessage,
  DayRunState,
  DayScenario,
} from "@/lib/scenarios/types";
import { evalCondition, recomputeTasksDone } from "./conditions";
import {
  buildCharacterPrompt,
  buildGroupPrompt,
  buildSaathiPrompt,
  looksLikePromptLeak,
} from "./prompts";
import { saveDayRun } from "./store";

function bump(run: DayRunState, key: string, by = 1) {
  run.counters[key] = (run.counters[key] ?? 0) + by;
}

function addMessage(
  run: DayRunState,
  msg: Omit<ChatMessage, "id" | "createdAt"> & { createdAt?: string },
) {
  run.messages.push({
    id: randomUUID(),
    createdAt: msg.createdAt || new Date().toISOString(),
    thread: msg.thread,
    sender: msg.sender,
    text: msg.text,
    system: msg.system,
  });
}

async function runAiReply(
  run: DayRunState,
  day: DayScenario,
  from: string,
  direction?: string,
) {
  const track = loadTrack(run.trackId);
  const castMap = getCastMap(track);
  const dayChar = day.characters.find((c) => c.id === from);
  const cast = castMap[from];
  if (!dayChar || !cast) return;

  if (dayChar.limits?.data_pulls != null) {
    const used = run.counters[`${from}.data_pulls`] ?? 0;
    if (used >= dayChar.limits.data_pulls) {
      addMessage(run, {
        thread: from,
        sender: from,
        text: "I've hit today's data-pull limit. Let's pick this up tomorrow.",
      });
      return;
    }
  }

  if (dayChar.limits?.questions != null) {
    const used = run.counters[`${from}.messages`] ?? 0;
    if (used >= dayChar.limits.questions) {
      addMessage(run, {
        thread: from,
        sender: from,
        text: "I need to jump — thanks for the chat. Good luck with the rest of your day.",
      });
      return;
    }
  }

  let text = "";
  let returnedData = false;

  const lastLearner =
    [...run.messages]
      .reverse()
      .find((m) => m.thread === from && m.sender === "learner")?.text || "";

  if (!openRouterConfigured()) {
    const mock = mockCharacterReply({
      name: cast.name,
      learnerText: direction || lastLearner,
      isLakshmi: from === "lakshmi",
    });
    text = mock.text;
    returnedData = Boolean(mock.returned_data);
  } else {
    const messages = buildCharacterPrompt({
      track,
      day,
      cast,
      dayChar,
      run,
      direction,
    });
    const raw = await chatCompletion({
      messages,
      jsonMode: dayChar.reply_flags?.includes("returned_data"),
    });

    if (dayChar.reply_flags?.includes("returned_data")) {
      try {
        const parsed = JSON.parse(raw) as {
          text?: string;
          returned_data?: boolean;
        };
        text = parsed.text || raw;
        returnedData = Boolean(parsed.returned_data);
      } catch {
        text = raw.replace(/\[PULL\]/gi, "").trim();
        returnedData = /\[PULL\]/i.test(raw) || /\d+%|₹\d+/.test(raw);
      }
    } else {
      text = raw;
    }
  }

  if (looksLikePromptLeak(text, day)) {
    text =
      "Let's stay on the work problem — what specifically do you need from me?";
    returnedData = false;
  }

  addMessage(run, { thread: from, sender: from, text });

  if (returnedData && dayChar.reply_flags?.includes("returned_data")) {
    bump(run, `${from}.data_pulls`);
  }
}

async function applyActions(
  run: DayRunState,
  day: DayScenario,
  actions: Action[],
) {
  for (const action of actions) {
    if ("unlock" in action) {
      if (!run.unlocked.includes(action.unlock)) {
        run.unlocked.push(action.unlock);
        const ch = day.characters.find((c) => c.id === action.unlock);
        if (ch?.opener) {
          addMessage(run, {
            thread: action.unlock,
            sender: action.unlock,
            text: ch.opener,
          });
        }
      }
    } else if ("message" in action) {
      if (!run.unlocked.includes(action.message.from)) {
        run.unlocked.push(action.message.from);
      }
      addMessage(run, {
        thread: action.message.from,
        sender: action.message.from,
        text: action.message.text,
      });
    } else if ("ai_reply" in action) {
      await runAiReply(
        run,
        day,
        action.ai_reply.from,
        action.ai_reply.direction,
      );
    } else if ("open" in action) {
      run.openHint = action.open;
    }
  }
}

export async function processTriggers(run: DayRunState, day: DayScenario) {
  let changed = true;
  let guard = 0;
  while (changed && guard < 12) {
    changed = false;
    guard += 1;
    for (const trigger of day.triggers) {
      if (run.triggersFired.includes(trigger.id)) continue;
      if (!evalCondition(trigger.when, run, day)) continue;
      run.triggersFired.push(trigger.id);
      await applyActions(run, day, trigger.do);
      changed = true;
    }
  }
}

export async function handleLearnerMessage(opts: {
  run: DayRunState;
  thread: string;
  text: string;
}) {
  const { run, thread } = opts;
  const text = opts.text.trim();
  if (!text) throw new Error("Empty message");

  const day = loadDay(run.trackId, run.day);
  const track = loadTrack(run.trackId);

  if (thread !== "saathi" && !run.unlocked.includes(thread)) {
    throw new Error("This chat is locked");
  }

  addMessage(run, { thread, sender: "learner", text });

  if (thread !== "saathi") {
    bump(run, `${thread}.messages`);
  }

  const group = day.group_chats.find((g) => g.id === thread);

  if (thread === "saathi") {
    if (!openRouterConfigured()) {
      addMessage(run, {
        thread: "saathi",
        sender: "saathi",
        text: "I'm Saathi. In demo mode I can still help structure your thinking — add OPENROUTER_API_KEY for full assistance. What do you want to summarise or draft?",
      });
    } else {
      const messages = buildSaathiPrompt({ track, day, run });
      const reply = await chatCompletion({ messages, temperature: 0.5 });
      addMessage(run, { thread: "saathi", sender: "saathi", text: reply });
    }
  } else if (group) {
    const castMap = getCastMap(track);
    const members = group.members.map((id) => castMap[id]).filter(Boolean);
    const dayChars = group.members
      .map((id) => day.characters.find((c) => c.id === id))
      .filter(Boolean) as typeof day.characters;

    if (!openRouterConfigured()) {
      const speaker = members[0];
      addMessage(run, {
        thread,
        sender: speaker?.id || "system",
        text: `Noted. Let's discuss. (Demo group reply — set OPENROUTER_API_KEY for live meeting rooms.)`,
      });
    } else {
      const messages = buildGroupPrompt({
        track,
        day,
        run,
        groupId: thread,
        members,
        dayChars,
      });
      const raw = await chatCompletion({ messages, jsonMode: true });
      try {
        const parsed = JSON.parse(raw) as {
          replies?: { from: string; text: string }[];
        };
        for (const r of (parsed.replies || []).slice(0, 3)) {
          if (!group.members.includes(r.from)) continue;
          addMessage(run, { thread, sender: r.from, text: r.text });
        }
      } catch {
        addMessage(run, {
          thread,
          sender: members[0]?.id || "system",
          text: raw,
        });
      }
    }
  } else {
    await runAiReply(run, day, thread);
  }

  recomputeTasksDone(run, day);
  await processTriggers(run, day);
  recomputeTasksDone(run, day);
  saveDayRun(run);
  return run;
}

export async function handleSubmission(opts: {
  run: DayRunState;
  taskId: string;
  text: string;
}) {
  const { run, taskId } = opts;
  const text = opts.text.trim();
  if (!text) throw new Error("Empty submission");

  const day = loadDay(run.trackId, run.day);
  const task = day.tasks.find((t) => t.id === taskId);
  if (!task) throw new Error("Unknown task");
  if (task.kind !== "submission") {
    throw new Error("This task is completed in chat, not by submission");
  }

  run.submissions[taskId] = {
    text,
    createdAt: new Date().toISOString(),
  };

  if (task.submit_to) {
    addMessage(run, {
      thread: task.submit_to,
      sender: "learner",
      text: `[Submitted: ${task.title}]\n\n${text}`,
    });
    bump(run, `${task.submit_to}.messages`);
  }

  recomputeTasksDone(run, day);
  await processTriggers(run, day);
  recomputeTasksDone(run, day);
  saveDayRun(run);
  return run;
}
