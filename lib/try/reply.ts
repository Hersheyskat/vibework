import { completeJson, completeText } from "@/lib/ai/client";
import { characterPrompt, CHAR_PROMPT_VERSION } from "@/lib/ai/prompts/character";
import { getScore } from "@/lib/db/scores";
import { idSlug } from "@/lib/scenario/normalize";
import type { ScenarioBundle } from "@/lib/scenario/schema";
import { bossId } from "@/lib/try/engine/cond";
import type { GameState } from "@/lib/try/engine/types";
import { dayOver } from "@/lib/try/transcript";
import { z } from "zod";

const dataReplySchema = z.object({
  text: z.string(),
  returned_data: z.boolean(),
});

export async function generateCharacterReply(opts: {
  bundle: ScenarioBundle;
  state: GameState;
  characterId: string;
  direction?: string;
  gameId: string;
  runId?: string;
}): Promise<{ text: string; returnedData: boolean }> {
  const score =
    opts.characterId === "mentor" && dayOver(opts.state, opts.bundle)
      ? await getScore(opts.gameId)
      : null;

  const built = characterPrompt(
    opts.bundle,
    opts.state,
    opts.characterId,
    opts.direction,
    score?.feedback ?? null,
  );

  if (built.jsonMode) {
    const { data } = await completeJson({
      job: "info_source",
      purpose: `chat:${opts.characterId}`,
      promptVersion: CHAR_PROMPT_VERSION,
      gameId: opts.gameId,
      runId: opts.runId,
      messages: [{ role: "user", content: built.system }],
      schema: dataReplySchema,
      maxTokens: 800,
    });
    return { text: data.text.trim() || "…", returnedData: data.returned_data };
  }

  const job =
    opts.characterId === "assist"
      ? "saathi"
      : opts.characterId === "mentor"
        ? built.jobHint === "debrief"
          ? "debrief"
          : "mentor"
        : idSlug(opts.characterId) === bossId(opts.bundle)
          ? "boss"
          : "colleague";

  const text = await completeText({
    job,
    purpose: `chat:${opts.characterId}`,
    promptVersion: CHAR_PROMPT_VERSION,
    gameId: opts.gameId,
    runId: opts.runId,
    messages: [{ role: "user", content: built.system }],
    maxTokens: built.jobHint === "debrief" ? 2500 : 600,
    temperature: 0.5,
  });
  return { text: text.trim() || "…", returnedData: false };
}

/** Drain replyQueue sequentially. */
export async function drainReplyQueue(opts: {
  bundle: ScenarioBundle;
  state: GameState;
  gameId: string;
  runId?: string;
}) {
  while (opts.state.replyQueue.length) {
    const item = opts.state.replyQueue.shift()!;
    const { text, returnedData } = await generateCharacterReply({
      bundle: opts.bundle,
      state: opts.state,
      characterId: item.from,
      direction: item.direction,
      gameId: opts.gameId,
      runId: opts.runId,
    });
    if (!opts.state.threads[item.from]) opts.state.threads[item.from] = [];
    opts.state.threads[item.from]!.push({
      f: "them",
      t: text,
      returned_data: returnedData || undefined,
    });
    if (returnedData) {
      const key = `${item.from}.data_pulls`;
      opts.state.counters[key] = (opts.state.counters[key] || 0) + 1;
    }
    if (opts.state.view !== `chat:${item.from}`) {
      opts.state.unread[item.from] =
        (opts.state.unread[item.from] || 0) + 1;
      opts.state.toast = item.from;
    }
  }
}
