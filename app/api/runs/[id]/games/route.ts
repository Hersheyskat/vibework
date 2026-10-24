import { NextResponse } from "next/server";
import { trackEvent } from "@/lib/analytics/track";
import { hasDbAccess } from "@/lib/db";
import { getRunForUser } from "@/lib/db/runs";
import { createClient } from "@/lib/supabase/server";
import { startGameFromRun } from "@/lib/try/load-game";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: runId } = await ctx.params;
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

  const run = await getRunForUser(runId, user.id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.status !== "ready") {
    return NextResponse.json(
      { error: "Day is not ready to play yet" },
      { status: 409 },
    );
  }

  const result = await startGameFromRun({ userId: user.id, runId });
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }
  await trackEvent(
    "day_started",
    { runId, gameId: result.gameId, level: run.level },
    user.id,
  );
  return NextResponse.json({ gameId: result.gameId });
}
