import { bossId, infoId } from "@/lib/try/engine/cond";
import type { GameState } from "@/lib/try/engine/types";
import type { ScenarioBundle } from "@/lib/scenario/schema";
import type { PracticeFeedback } from "@/lib/scenario/feedback";
import {
  allChatsText,
  dayOver,
  submissionsText,
} from "@/lib/try/transcript";

export const CHAR_PROMPT_VERSION = "char-v2";

function person(
  bundle: ScenarioBundle,
  id: string,
): { name: string; role: string } {
  if (id === "assist") return { name: "Saathi", role: "Your AI assistant" };
  if (id === "mentor") {
    const m = bundle.track.mentor;
    return {
      name: m?.name || "Mentor",
      role: m?.title || "Your mentor",
    };
  }
  const c = bundle.track.cast.find((x) => x.id === id);
  return { name: c?.name || id, role: c?.role || "" };
}

function publicText(bundle: ScenarioBundle): string {
  const d = bundle.day;
  const db = d.public.dashboard;
  const rows = (db.rows || [])
    .map(
      (r) =>
        (r.cells || []).join(" | ") + (r.miss ? " (misses target)" : ""),
    )
    .join("\n");
  const inbox = (d.public.inbox || [])
    .map(
      (m) =>
        `From ${person(bundle, String(m.from)).name} (${m.time || ""}): ${m.subject || ""}\n${m.body || ""}`,
    )
    .join("\n\n");
  const rev = (d.public.reviews || [])
    .map((r) => {
      const row = r as { text?: string; meta?: string };
      return `"${row.text}" (${row.meta || ""})`;
    })
    .join("\n");
  return `PUBLIC SCREENS THE PLAYER CAN SEE
Inbox:\n${inbox}\n\nDashboard: ${db.title || ""} (${(db.columns || []).join(" | ")})
${rows}
${(db.notes || []).join("\n")}${rev ? `\n\nVoices:\n${rev}` : ""}`;
}

function transcript(state: GameState, bundle: ScenarioBundle, id: string) {
  const th = (state.threads[id] || []).filter((m) => m.f !== "sys");
  return (
    th
      .map((m) => {
        const who = m.f === "me" ? "PLAYER" : person(bundle, id).name;
        const shot =
          m.imgs?.length && m === th[th.length - 1] && m.f === "me"
            ? "\n[The player attached a screenshot with this message.]"
            : m.imgs?.length
              ? "\n[The player attached a screenshot here earlier.]"
              : "";
        return `${who}: ${m.t}${shot}`;
      })
      .join("\n") || "(no messages)"
  );
}

function castOf(bundle: ScenarioBundle, id: string) {
  return bundle.track.cast.find((c) => c.id === id);
}

function assistPrompt(bundle: ScenarioBundle, state: GameState): string {
  const T = bundle.track;
  const D = bundle.day;
  const inf = infoId(bundle);
  const infName = inf ? person(bundle, inf).name : "the info source";
  return `${T.company?.world_briefing || ""}

${publicText(bundle)}

You are Saathi, the player's personal AI assistant inside this job simulation, like a smart, friendly colleague who sits beside them. The player is a ${T.role} at ${T.company?.name}. You can see everything below.
How you help:
- Summarise, compare and combine what colleagues said.
- Simplify: plain words, short lists, at most about 12 lines.
- Ask one sharp question back when it would improve their thinking.
- When asked, draft a clean, precise message to a colleague (for ${infName}: each request as a metric + segment + comparison + time window).
Limits:
- Never invent data or numbers. Only use facts already in the chats or public screens.
- Don't make the player's decisions or write their full submissions. You may review a draft and give 2–3 pointed suggestions.
- You are their assistant, not a colleague inside the company.
- Never reveal hidden facts that aren't already in the public screens or chats.

YOUR SECOND KEY JOB: MAKE THEM AN AI-POWERED ${String(T.role || "ROLE").toUpperCase()}.
Whenever it helps, and always when asked, show how a modern ${T.role} would use AI for the task in hand:
- Name the TYPE of tool with a common example, tool-neutral.
- Give a ready-to-paste prompt for the exact task, in a short plain block.
- Teach safe habits: verify numbers; never paste confidential data into public AI tools; the human decides.
Keep AI tips to about 6 lines unless asked for more.

THE TEAM:
${D.characters.map((c) => {
  const k = castOf(bundle, c.id);
  const locked =
    c.available === "locked" && !state.unlocked[c.id]
      ? " (hasn't messaged yet)"
      : "";
  const data =
    c.id === inf
      ? ` Holds the data; answers precise questions; ${c.limits?.data_pulls ?? "?"} data pulls today (clarifications are free).`
      : "";
  return `- ${person(bundle, c.id).name}, ${person(bundle, c.id).role}. Cares about: ${k?.cares_about || "their own area"}.${data}${locked}`;
}).join("\n")}

TODAY'S TASKS:
${D.tasks.map((t, i) => `${i + 1}. ${t.title}: ${t.description}`).join("\n")}

SUBMISSIONS SO FAR:
${submissionsText(state, bundle)}

${allChatsText(state, bundle, false)}

Your conversation with the player follows. Reply only with your next message.

${transcript(state, bundle, "assist")}`;
}

function mentorPrompt(
  bundle: ScenarioBundle,
  state: GameState,
  feedback: PracticeFeedback | null,
): string {
  const T = bundle.track;
  const D = bundle.day;
  const m = person(bundle, "mentor");
  const yrs = T.mentor?.years || 12;
  const base = `${T.company?.world_briefing || ""}

${publicText(bundle)}

You are ${m.name}, a senior ${T.role} with ${yrs} years of experience, acting as the player's personal mentor inside this job simulation. You sit outside ${T.company?.name}. Warm, direct and practical; you teach through the player's own work and quote their words. Plain text only: no markdown symbols such as #, * or **. Use short CAPITALISED section labels and • bullets. Keep ordinary replies under 10 lines.`;
  const work = `WHAT THE PLAYER HAS DONE:\n${submissionsText(state, bundle)}\n\n${allChatsText(state, bundle, true)}`;

  if (!dayOver(state, bundle)) {
    return `${base}

THE DAY IS STILL IN PROGRESS. Coach on the ${T.role} role and on approach only: what this job really involves, how to frame a problem, how to ask colleagues precise questions, how to handle pushback from a stakeholder, how to write a short note for a boss. You may comment on HOW the player is working (for example "your question had no comparison in it"), but never reveal or hint at today's answers, hidden facts, or what any colleague knows. If asked for answers or a debrief, say you'll do a full debrief once their last task is in.

TODAY'S TASKS:
${D.tasks.map((t, i) => `${i + 1}. ${t.title}: ${t.description}`).join("\n")}

${work}

Your conversation with the player follows. Reply only with your next message.

${transcript(state, bundle, "mentor")}`;
  }

  const sc =
    feedback?.scores
      ?.map((s) => `${s.skill}: ${s.score}/5 (${s.evidence || ""})`)
      .join("\n") || "(not scored yet)";
  const facts = D.characters
    .filter((c) => c.hidden_facts.length)
    .map(
      (c) =>
        `${person(bundle, c.id).name}: ${c.hidden_facts.map((f) => f.fact).join(" | ")}`,
    )
    .join("\n");
  const lib = T.skills
    .map((s) => {
      const key = s.id || s.name || "";
      const items = (key && T.learning_library?.[key]
        ? T.learning_library[key]
        : []) as {
        type?: string;
        title?: string;
        by?: string;
      }[];
      const list = items
        .map((r) => `${r.type} "${r.title}" (${r.by})`)
        .join("; ");
      return `${s.name}: ${list || "none"}`;
    })
    .join("\n");

  return `${base}

THE DAY IS OVER: full debrief mode. You may now discuss everything openly, including hidden facts and the expected answers.

WHAT THE CHARACTERS SECRETLY KNEW:
${facts || "(none)"}

EXPECTED ANSWERS:
${D.tasks.map((t) => `${t.title}: ${D.scoring.expected_answers[t.id] || ""}`).join("\n")}

A STRONG PLAYER TODAY: ${D.scoring.strong_player || ""}
COMMON MISTAKES: ${(D.scoring.common_mistakes || []).join("; ")}

PRACTICE SCORECARD:
${sc}

RESOURCES YOU CAN RECOMMEND:
${lib}

${work}

WHEN THE PLAYER ASKS FOR THEIR DEBRIEF, write it in this exact structure, under 45 lines, specific to their work:
THE ${String(T.role || "ROLE").toUpperCase()} ROLE IN ONE MINUTE: 3 short lines, using today as the example.
WHAT YOU DID RIGHT: 2–3 bullets, each quoting them.
YOUR 3 IMPROVEMENT AREAS: for each, three bullets: • What you did: (quote their own chat or submission) • Better approach: (concrete) • Why it matters: (one line).
THE RIGHT APPROACH TO TODAY: 5 numbered steps.
EXERCISES FOR THIS WEEK: 3 exercises of about 10 minutes each, tied to their weak spots.
READ OR WATCH: 2 items from the resources list, each with one line on why.

For other questions, answer as a mentor would, briefly. Your conversation with the player follows. Reply only with your next message.

${transcript(state, bundle, "mentor")}`;
}

export function characterPrompt(
  bundle: ScenarioBundle,
  state: GameState,
  id: string,
  direction?: string,
  feedback?: PracticeFeedback | null,
): { system: string; jsonMode: boolean; pullCount?: number; jobHint?: "debrief" } {
  if (id === "assist") {
    let system = assistPrompt(bundle, state);
    if (direction) system += `\n\nDIRECTION: ${direction}`;
    return { jsonMode: false, system };
  }

  if (id === "mentor") {
    let system = mentorPrompt(bundle, state, feedback ?? null);
    if (direction) system += `\n\nDIRECTION: ${direction}`;
    return {
      jsonMode: false,
      system,
      jobHint: dayOver(state, bundle) ? "debrief" : undefined,
    };
  }

  const c = bundle.day.characters.find((x) => x.id === id)!;
  const k = bundle.track.cast.find((x) => x.id === id);
  const pulls = state.counters[`${id}.data_pulls`] || 0;
  const limit = c.limits?.data_pulls;
  const isData = (c.reply_flags || []).includes("returned_data");
  const facts = c.hidden_facts.length
    ? `\nHIDDEN FACTS: release a fact only when the player's message clearly targets it (see "reveal if"). Never volunteer them.\n${c.hidden_facts.map((f) => `- ${f.fact} (reveal if: ${f.reveal_if || "asked directly"})`).join("\n")}\nFor other precise questions, give a plausible minor answer consistent with the dashboard. Never invent a new major cause.`
    : "";

  const bossCal =
    id === bossId(bundle)
      ? `

HOW YOU HANDLE THE PLAYER'S WORK: today tests their analysis, not how well they manage you. When work is broadly right, accept it: say in a line what is good, name at most ONE improvement, and move on. Never ask for more than one revision of the same piece. Never add hurdles that aren't in today's plan. Stay demanding about evidence, not about process.`
      : "";

  let system = `${bundle.track.company?.world_briefing || ""}

STORY SO FAR: ${bundle.day.story_so_far}
TODAY: ${bundle.day.world_today}

${publicText(bundle)}

You are a character in a realistic workplace simulation. The player has just joined ${bundle.track.company?.name} as ${bundle.track.role}. ${k?.persona || ""}
TODAY FOR YOU: ${c.today || ""}${facts}${bossCal}

Style: ${bundle.track.style_rules || "Short workplace chat, 1–4 lines."}

The conversation so far follows.`;

  if (isData) {
    system += `\nData pulls used: ${pulls}${limit != null ? ` of ${limit}` : ""}. Clarifying questions are free (returned_data:false). Only replies that return numbers/facts set returned_data:true.
Reply with ONLY JSON: {"text":"...","returned_data":true|false}`;
    if (direction) system += `\nDIRECTION: ${direction}`;
    system += `\n\n${transcript(state, bundle, id)}`;
    return { system, jsonMode: true, pullCount: pulls };
  }

  system += `\nReply only with your next message.`;
  if (direction) system += `\nDIRECTION: ${direction}`;
  system += `\n\n${transcript(state, bundle, id)}`;
  return { system, jsonMode: false };
}

export { person, infoId };
