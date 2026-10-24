import { gte, sql } from "drizzle-orm";
import { getDb, hasDbAccess } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { llmCalls } from "@/lib/db/schema";
import { limitsConfig } from "./config";

export type BudgetStatus = {
  ceilingUsd: number;
  spentUsd: number;
  remainingUsd: number;
  ok: boolean;
  reason: string | null;
};

function usePg() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function startOfUtcDay(d = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export async function todaySpendUsd(): Promise<number> {
  if (!hasDbAccess()) return 0;
  const since = startOfUtcDay();
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .select({
        sum: sql<number>`coalesce(sum(${llmCalls.costUsd}), 0)`,
      })
      .from(llmCalls)
      .where(gte(llmCalls.createdAt, since));
    return Number(row?.sum ?? 0);
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("llm_calls")
    .select("cost_usd")
    .gte("created_at", since.toISOString());
  if (error) throw new Error(error.message);
  return (data || []).reduce(
    (s, r) => s + (Number(r.cost_usd) || 0),
    0,
  );
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  const ceiling = limitsConfig().dailyBudgetUsd;
  if (ceiling <= 0) {
    return {
      ceilingUsd: 0,
      spentUsd: 0,
      remainingUsd: Infinity,
      ok: true,
      reason: null,
    };
  }
  const spent = await todaySpendUsd();
  const ok = spent < ceiling;
  return {
    ceilingUsd: ceiling,
    spentUsd: spent,
    remainingUsd: Math.max(0, ceiling - spent),
    ok,
    reason: ok
      ? null
      : "We're pausing new work-days for today while we stay inside our AI budget. Try again tomorrow, or open a day you've already built.",
  };
}

/** Fire-and-forget alert when the ceiling is crossed (webhook URL optional). */
export async function alertBudgetIfNeeded(status: BudgetStatus): Promise<void> {
  if (status.ok) return;
  const url = limitsConfig().budgetAlertUrl;
  console.warn(
    "[vibework] daily budget reached",
    status.spentUsd.toFixed(2),
    "/",
    status.ceilingUsd,
  );
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `VibeWork daily AI budget hit: $${status.spentUsd.toFixed(2)} / $${status.ceilingUsd}`,
        spentUsd: status.spentUsd,
        ceilingUsd: status.ceilingUsd,
      }),
    });
  } catch (e) {
    console.error("[vibework] budget alert failed", e);
  }
}
