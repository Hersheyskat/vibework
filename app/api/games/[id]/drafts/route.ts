import { NextResponse } from "next/server";
import { z } from "zod";
import { hasDbAccess } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { applyDraft } from "@/lib/try/actions";
import {
  loadOwnedGame,
  persistState,
  publicPayload,
} from "@/lib/try/load-game";

const bodySchema = z.object({
  key: z.string().min(1),
  text: z.string(),
});

export async function PUT(
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

  applyDraft(loaded.row.state, parsed.data.key, parsed.data.text);
  await persistState(id, loaded.row.state);
  return NextResponse.json(publicPayload(loaded));
}
