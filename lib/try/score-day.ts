import { completeJson } from "@/lib/ai/client";
import {
  SCORE_PROMPT_VERSION,
  scorePrompt,
  feedbackSchema,
  type PracticeFeedback,
} from "@/lib/ai/prompts/score";
import { getScore, saveScore } from "@/lib/db/scores";
import type { ScenarioBundle } from "@/lib/scenario/schema";
import type { GameState } from "@/lib/try/engine/types";
import { dayOver } from "@/lib/try/transcript";
import type { LevelId } from "@/lib/try/levels";

export async function scoreGameDay(opts: {
  gameId: string;
  runId?: string;
  bundle: ScenarioBundle;
  state: GameState;
  level: LevelId;
  rescore?: boolean;
}): Promise<
  | { ok: true; feedback: PracticeFeedback; total: number }
  | { ok: false; error: string; status: number }
> {
  if (!dayOver(opts.state, opts.bundle)) {
    return {
      ok: false,
      error: "Finish today's tasks before scoring.",
      status: 409,
    };
  }

  if (!opts.rescore) {
    const existing = await getScore(opts.gameId);
    if (existing) {
      return {
        ok: true,
        feedback: existing.feedback,
        total: existing.total,
      };
    }
  }

  const { data, model } = await completeJson({
    job: "score",
    purpose: "score",
    promptVersion: SCORE_PROMPT_VERSION,
    gameId: opts.gameId,
    runId: opts.runId,
    maxTokens: 4000,
    messages: [
      {
        role: "user",
        content: scorePrompt(opts.bundle, opts.state, opts.level),
      },
    ],
    schema: feedbackSchema,
  });

  // Align skill names to track order when model drifts
  const skillNames = opts.bundle.track.skills
    .map((s) => s.name)
    .filter((n): n is string => Boolean(n));
  const bySkill = new Map(
    data.scores.map((s) => [s.skill.toLowerCase(), s]),
  );
  const ordered = skillNames.map((name) => {
    const hit =
      bySkill.get(name.toLowerCase()) ||
      data.scores.find((s) =>
        s.skill.toLowerCase().includes(name.toLowerCase().slice(0, 6)),
      );
    return {
      skill: name,
      score: Math.max(1, Math.min(5, Number(hit?.score) || 2)),
      evidence: hit?.evidence || "",
    };
  });
  const feedback: PracticeFeedback = { ...data, scores: ordered };

  const total = await saveScore({
    gameId: opts.gameId,
    feedback,
    model,
    promptVersion: SCORE_PROMPT_VERSION,
  });

  return { ok: true, feedback, total };
}
