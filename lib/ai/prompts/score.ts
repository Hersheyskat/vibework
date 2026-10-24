import type { PracticeFeedback } from "@/lib/scenario/feedback";
import { feedbackSchema } from "@/lib/scenario/feedback";
import type { ScenarioBundle } from "@/lib/scenario/schema";
import type { GameState } from "@/lib/try/engine/types";
import { allChatsText, submissionsText } from "@/lib/try/transcript";
import type { LevelId } from "@/lib/try/levels";

export const SCORE_PROMPT_VERSION = "score-v1";

export { feedbackSchema };
export type { PracticeFeedback };

function personName(bundle: ScenarioBundle, id: string): string {
  return bundle.track.cast.find((c) => c.id === id)?.name || id;
}

export function scorePrompt(
  bundle: ScenarioBundle,
  state: GameState,
  level: LevelId,
): string {
  const T = bundle.track;
  const D = bundle.day;
  const names = T.skills.map((s) => s.name);
  const facts = D.characters
    .filter((c) => c.hidden_facts.length)
    .map((c) =>
      c.hidden_facts
        .map((f) => `- (${personName(bundle, c.id)}) ${f.fact}`)
        .join("\n"),
    )
    .join("\n");

  const taskShape = D.tasks
    .map(
      (t) =>
        `{"task":${JSON.stringify(t.title)},"gap":"1–2 sentences comparing their answer to the ideal"}`,
    )
    .join(",");

  return `${T.company?.world_briefing || ""}

You are a demanding senior ${T.role} assessing a candidate's PRACTICE work-day in a job simulation (level: ${level}). Score six skills 1–5, honestly; do not inflate (3 = competent fresher, 5 = would impress a hiring manager). Quote the player's own words as evidence. If a task was skipped, score related skills low and say so. Using the AI assistant is allowed and realistic: credit using it to sharpen their own thinking and communication, not to outsource decisions. Compare each task against the expected answer, but reward sound alternative reasoning backed by evidence. Score the FINAL version of each submission, and give credit for improving work after feedback. This day tests analysis and judgment; don't mark the player down for not winning extra approvals from the boss.

A STRONG PLAYER TODAY: ${D.scoring.strong_player || ""}
HIDDEN FACTS THE PLAYER COULD HAVE UNCOVERED:
${facts || "(none listed)"}
EXPECTED ANSWERS:
${D.tasks.map((t) => `${t.title}: ${D.scoring.expected_answers[t.id] || ""}`).join("\n")}
COMMON MISTAKES: ${(D.scoring.common_mistakes || []).join("; ")}

WHAT THE PLAYER DID:
${submissionsText(state, bundle)}

${allChatsText(state, bundle, true)}

Reply with only JSON in this shape:
{"verdict":"one sentence overall verdict","scores":[{"skill":${JSON.stringify(names[0] || "Skill")},"score":3,"evidence":"one or two sentences quoting the player"}],"strengths":["2–3 specific things they got right"],"improve":["2–3 specific things to improve"],"tasks":[${taskShape}],"senior":"3–4 sentences on what a senior ${T.role} would have done today","missed":["hidden facts they never uncovered, in plain words"],"drill":"one 10-minute practice exercise targeting their weakest skill"}
Use exactly these six skill names, in this order: ${names.join(", ")}.`;
}
