import { NextResponse } from "next/server";
import { hasDbAccess } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { loadOwnedGame, publicPayloadAsync } from "@/lib/try/load-game";

export async function GET(
  _req: Request,
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

  const loaded = await loadOwnedGame(id, user.id);
  if (!loaded) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  return NextResponse.json(await publicPayloadAsync(loaded));
}
