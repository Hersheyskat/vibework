import type { ScenarioBundle } from "@/lib/scenario/schema";
import { taskDone } from "@/lib/try/engine/cond";
import type { GameState } from "@/lib/try/engine/types";

function personName(bundle: ScenarioBundle, id: string): string {
  if (id === "assist") return "Saathi";
  if (id === "mentor") return bundle.track.mentor?.name || "Mentor";
  return bundle.track.cast.find((c) => c.id === id)?.name || id;
}

export function submissionsText(
  state: GameState,
  bundle: ScenarioBundle,
): string {
  const lines: string[] = [];
  for (const t of bundle.day.tasks) {
    const final = state.sub[t.id];
    const hist = state.subHist[t.id] || [];
    if (!final && !hist.length) {
      lines.push(`${t.title}: (not submitted)`);
      continue;
    }
    if (hist.length) {
      lines.push(
        `${t.title} — earlier drafts:\n${hist.map((h, i) => `  v${i + 1}: ${h}`).join("\n")}`,
      );
    }
    lines.push(`${t.title} — FINAL:\n${final || "(missing)"}`);
  }
  return lines.join("\n\n") || "(no submissions)";
}

export function allChatsText(
  state: GameState,
  bundle: ScenarioBundle,
  includeAssist: boolean,
): string {
  const ids = [
    ...bundle.day.characters.map((c) => c.id),
    ...(includeAssist ? ["assist"] : []),
    "mentor",
  ];
  const blocks: string[] = [];
  for (const id of ids) {
    const th = state.threads[id] || [];
    const msgs = th.filter((m) => m.f !== "sys");
    if (!msgs.length) continue;
    blocks.push(
      `--- Chat with ${personName(bundle, id)} ---\n` +
        msgs
          .map((m) => {
            const who = m.f === "me" ? "PLAYER" : personName(bundle, id);
            const shot =
              m.imgs?.length && m === msgs[msgs.length - 1] && m.f === "me"
                ? "\n[The player attached a screenshot with this message. Read it if you can; otherwise ask them to describe what it shows.]"
                : m.imgs?.length
                  ? "\n[The player attached a screenshot here earlier.]"
                  : "";
            return `${who}: ${m.t}${shot}`;
          })
          .join("\n"),
    );
  }
  return blocks.join("\n\n") || "(no chats)";
}

export function dayOver(state: GameState, bundle: ScenarioBundle): boolean {
  return bundle.day.tasks.every((t) => taskDone(t, state, bundle));
}

export const DEBRIEF_REQUEST = "Please give me my end-of-day debrief.";
