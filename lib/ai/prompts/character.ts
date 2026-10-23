import { bossId, infoId } from "@/lib/try/engine/cond";
import type { GameState } from "@/lib/try/engine/types";
import type { ScenarioBundle } from "@/lib/scenario/schema";

export const CHAR_PROMPT_VERSION = "char-v1";

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
  return (
    (state.threads[id] || [])
      .filter((m) => m.f !== "sys")
      .map(
        (m) =>
          `${m.f === "me" ? "PLAYER" : person(bundle, id).name}: ${m.t}`,
      )
      .join("\n") || "(no messages)"
  );
}

export function characterPrompt(
  bundle: ScenarioBundle,
  state: GameState,
  id: string,
  direction?: string,
): { system: string; jsonMode: boolean; pullCount?: number } {
  if (id === "assist") {
    return {
      jsonMode: false,
      system: `${bundle.track.company?.world_briefing || ""}

${publicText(bundle)}

You are Saathi, the player's personal AI assistant inside this job simulation. The player is a ${bundle.track.role} at ${bundle.track.company?.name}. Help with the work: summarise, draft precise asks, critique drafts. Never invent numbers. Never reveal hidden facts. Keep replies under ~12 lines.

Conversation so far:
${transcript(state, bundle, "assist")}
${direction ? `\nDIRECTION: ${direction}` : ""}

Reply with only your next message.`,
    };
  }

  if (id === "mentor") {
    return {
      jsonMode: false,
      system: `You are ${bundle.track.mentor?.name || "Mentor"}, ${bundle.track.mentor?.title || "mentor"}. Coach on approach during the day. Never reveal answers or hidden facts. Keep to 3–6 short lines.

Conversation:
${transcript(state, bundle, "mentor")}
${direction ? `\nDIRECTION: ${direction}` : ""}

Reply with only your next message.`,
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
