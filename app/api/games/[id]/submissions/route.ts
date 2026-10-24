import { NextResponse } from "next/server";
import { z } from "zod";
import { openRouterConfigured } from "@/lib/ai/client";
import { trackEvent } from "@/lib/analytics/track";
import { hasDbAccess } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  applyRevision,
  applySubmission,
  setRevising,
} from "@/lib/try/actions";
import { drainReplyQueue } from "@/lib/try/reply";
import {
  loadOwnedGame,
  persistState,
  publicPayloadAsync,
} from "@/lib/try/load-game";

const bodySchema = z.object({
  taskId: z.string().min(1),
  text: z.string().optional(),
  revise: z.boolean().optional(),
  startRevise: z.boolean().optional(),
  cancelRevise: z.boolean().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const loaded = await loadOwnedGame(id, user.id);
  if (!loaded) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (parsed.data.startRevise) {
    setRevising(loaded.row.state, parsed.data.taskId, true);
    await persistState(id, loaded.row.state);
    return NextResponse.json(await publicPayloadAsync(loaded));
  }
  if (parsed.data.cancelRevise) {
    setRevising(loaded.row.state, parsed.data.taskId, false);
    delete loaded.row.state.tdraft[parsed.data.taskId];
    await persistState(id, loaded.row.state);
    return NextResponse.json(await publicPayloadAsync(loaded));
  }

  if (!openRouterConfigured()) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not set" },
      { status: 503 },
    );
  }

  const text = parsed.data.text ?? "";
  const result = parsed.data.revise
    ? applyRevision(
        loaded.row.state,
        loaded.bundle,
        parsed.data.taskId,
        text,
      )
    : applySubmission(
        loaded.row.state,
        loaded.bundle,
        parsed.data.taskId,
        text,
      );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  await persistState(id, loaded.row.state);

  try {
    await drainReplyQueue({
      bundle: loaded.bundle,
      state: loaded.row.state,
      gameId: id,
      runId: loaded.row.runId,
    });
  } catch {
    loaded.row.state.threads[result.submitTo]?.push({
      f: "sys",
      t: "Couldn't get a reply just now. Try again in a moment.",
    });
  }

  await persistState(id, loaded.row.state);

  const rev =
    (loaded.row.state.subHist[parsed.data.taskId] || []).length;
  await trackEvent(
    "task_submitted",
    {
      gameId: id,
      taskId: parsed.data.taskId,
      revision: rev,
      revise: Boolean(parsed.data.revise),
    },
    user.id,
  );

  return NextResponse.json(await publicPayloadAsync(loaded));
}
