import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics/track";
import { hasDbAccess } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { loadOwnedGame, publicPayload } from "@/lib/try/load-game";
import { scoreGameDay } from "@/lib/try/score-day";
import type { LevelId } from "@/lib/try/levels";
import { getScore } from "@/lib/db/scores";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id: gameId } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!hasDbAccess()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  const loaded = await loadOwnedGame(gameId, user.id);
  if (!loaded) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { rescore?: boolean };
  const result = await scoreGameDay({
    gameId,
    runId: loaded.row.runId,
    bundle: loaded.bundle,
    state: loaded.row.state,
    level: loaded.level as LevelId,
    rescore: Boolean(body.rescore),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const refreshed = await loadOwnedGame(gameId, user.id);
  if (!refreshed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const score = await getScore(gameId);
  const pub = publicPayload(refreshed, score?.feedback ?? result.feedback);

  await trackEvent(
    "day_scored",
    {
      gameId,
      total: result.total,
      skills: result.feedback.scores.map((s) => ({
        skill: s.skill,
        score: s.score,
      })),
    },
    user.id,
  );

  return NextResponse.json({
    total: result.total,
    feedback: result.feedback,
    game: pub,
  });
}
