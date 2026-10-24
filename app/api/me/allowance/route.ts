import { NextResponse } from "next/server";
import { hasDbAccess } from "@/lib/db";
import { getAllowance } from "@/lib/limits/caps";
import { getBudgetStatus } from "@/lib/limits/budget";
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
  const [allowance, budget] = await Promise.all([
    getAllowance(user.id),
    getBudgetStatus(),
  ]);
  return NextResponse.json({
    allowance,
    budgetPaused: !budget.ok,
    budgetReason: budget.reason,
  });
}
