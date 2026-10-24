import { and, eq, gte, sql } from "drizzle-orm";
import { getDb, hasDbAccess } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { runs } from "@/lib/db/schema";
import { limitsConfig } from "./config";

export type Allowance = {
  daysPerDay: number;
  daysPerMonth: number;
  usedToday: number;
  usedThisMonth: number;
  remainingToday: number;
  remainingMonth: number;
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

function startOfUtcMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function countRunsSince(userId: string, since: Date): Promise<number> {
  if (!hasDbAccess()) return 0;
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(runs)
      .where(and(eq(runs.userId, userId), gte(runs.createdAt, since)));
    return Number(row?.n ?? 0);
  }
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from("runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getAllowance(userId: string): Promise<Allowance> {
  const cfg = limitsConfig();
  const usedToday = await countRunsSince(userId, startOfUtcDay());
  const usedThisMonth = await countRunsSince(userId, startOfUtcMonth());
  const remainingToday = Math.max(0, cfg.daysPerDay - usedToday);
  const remainingMonth = Math.max(0, cfg.daysPerMonth - usedThisMonth);
  let reason: string | null = null;
  if (remainingToday <= 0) {
    reason = `You've used today's free builds (${cfg.daysPerDay}). Come back tomorrow, or try one of your past days.`;
  } else if (remainingMonth <= 0) {
    reason = `You've used this month's free builds (${cfg.daysPerMonth}). Resume a past day from My days, or wait until next month.`;
  }
  return {
    daysPerDay: cfg.daysPerDay,
    daysPerMonth: cfg.daysPerMonth,
    usedToday,
    usedThisMonth,
    remainingToday,
    remainingMonth,
    ok: !reason,
    reason,
  };
}

export function countPlayerChats(
  threads: Record<string, { f: string }[]>,
): number {
  let n = 0;
  for (const msgs of Object.values(threads)) {
    for (const m of msgs) {
      if (m.f === "me") n += 1;
    }
  }
  return n;
}

export function chatCapExceeded(
  threads: Record<string, { f: string }[]>,
): string | null {
  const cap = limitsConfig().chatMessagesPerGame;
  if (countPlayerChats(threads) >= cap) {
    return `You've hit the ${cap} chat messages for this day. Finish your tasks, or open Progress for your score.`;
  }
  return null;
}
