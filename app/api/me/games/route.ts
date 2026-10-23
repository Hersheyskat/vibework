import { NextResponse } from "next/server";
import { hasDbAccess } from "@/lib/db";
import { listMyDays } from "@/lib/db/me";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
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

  const items = await listMyDays(user.id);
  return NextResponse.json({ items });
}
