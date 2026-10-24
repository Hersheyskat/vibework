import { NextResponse } from "next/server";
import { z } from "zod";
import { hasDbAccess } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { applyView } from "@/lib/try/actions";
import {
  loadOwnedGame,
  persistState,
  publicPayloadAsync,
} from "@/lib/try/load-game";

const bodySchema = z.object({ view: z.string().min(1) });

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

  applyView(loaded.row.state, parsed.data.view);
  await persistState(id, loaded.row.state);
  return NextResponse.json(await publicPayloadAsync(loaded));
}
