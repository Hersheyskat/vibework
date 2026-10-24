import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { games, scores } from "@/lib/db/schema";
import type { PracticeFeedback } from "@/lib/scenario/feedback";
import { feedbackTotal } from "@/lib/scenario/feedback";

function usePg() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export async function getScore(
  gameId: string,
): Promise<{
  feedback: PracticeFeedback;
  total: number;
  model: string | null;
  promptVersion: string | null;
} | null> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(scores)
      .where(eq(scores.gameId, gameId))
      .limit(1);
    if (!row) return null;
    return {
      feedback: row.feedbackJson as PracticeFeedback,
      total: row.total,
      model: row.model,
      promptVersion: row.promptVersion,
    };
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("scores")
    .select("feedback_json, total, model, prompt_version")
    .eq("game_id", gameId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    feedback: data.feedback_json as PracticeFeedback,
    total: data.total as number,
    model: (data.model as string) || null,
    promptVersion: (data.prompt_version as string) || null,
  };
}

export async function saveScore(opts: {
  gameId: string;
  feedback: PracticeFeedback;
  model: string;
  promptVersion: string;
}): Promise<number> {
  const total = feedbackTotal(opts.feedback);
  if (usePg()) {
    const db = getDb();
    const existing = await db
      .select({ gameId: scores.gameId })
      .from(scores)
      .where(eq(scores.gameId, opts.gameId))
      .limit(1);
    if (existing[0]) {
      await db
        .update(scores)
        .set({
          feedbackJson: opts.feedback,
          total,
          model: opts.model,
          promptVersion: opts.promptVersion,
        })
        .where(eq(scores.gameId, opts.gameId));
    } else {
      await db.insert(scores).values({
        gameId: opts.gameId,
        feedbackJson: opts.feedback,
        total,
        model: opts.model,
        promptVersion: opts.promptVersion,
      });
    }
    await db
      .update(games)
      .set({ status: "scored", finishedAt: new Date() })
      .where(eq(games.id, opts.gameId));
    return total;
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("scores").upsert(
    {
      game_id: opts.gameId,
      feedback_json: opts.feedback,
      total,
      model: opts.model,
      prompt_version: opts.promptVersion,
    },
    { onConflict: "game_id" },
  );
  if (error) throw new Error(error.message);
  await sb
    .from("games")
    .update({ status: "scored", finished_at: new Date().toISOString() })
    .eq("id", opts.gameId);
  return total;
}
