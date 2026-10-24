import { desc, eq, sql } from "drizzle-orm";
import { getDb, hasDbAccess } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { games, llmCalls, plans, runs, scores } from "@/lib/db/schema";

function usePg() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export type AdminRunRow = {
  id: string;
  userId: string;
  inputText: string;
  level: string;
  status: string;
  roleTitle: string | null;
  industry: string | null;
  attempt: number | null;
  passed: boolean | null;
  costUsd: number;
  createdAt: string;
};

export type AdminRoleStats = {
  role: string;
  runs: number;
  ready: number;
  passRate: number;
  games: number;
  scored: number;
  completionRate: number;
  medianScore: number | null;
  medianCost: number | null;
};

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export async function listAdminRuns(limit = 80): Promise<AdminRunRow[]> {
  if (!hasDbAccess()) return [];
  if (usePg()) {
    const db = getDb();
    const rows = await db
      .select({
        id: runs.id,
        userId: runs.userId,
        inputText: runs.inputText,
        level: runs.level,
        status: runs.status,
        screenJson: runs.screenJson,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .orderBy(desc(runs.createdAt))
      .limit(limit);

    const out: AdminRunRow[] = [];
    for (const r of rows) {
      const [plan] = await db
        .select({
          attempt: plans.attempt,
          passed: plans.passed,
        })
        .from(plans)
        .where(eq(plans.runId, r.id))
        .orderBy(desc(plans.attempt))
        .limit(1);
      const [cost] = await db
        .select({
          sum: sql<number>`coalesce(sum(${llmCalls.costUsd}), 0)`,
        })
        .from(llmCalls)
        .where(eq(llmCalls.runId, r.id));
      const screen = r.screenJson as {
        screen?: { role_title?: string; industry?: string };
      } | null;
      out.push({
        id: r.id,
        userId: r.userId,
        inputText: r.inputText.slice(0, 160),
        level: r.level,
        status: r.status,
        roleTitle: screen?.screen?.role_title ?? null,
        industry: screen?.screen?.industry ?? null,
        attempt: plan?.attempt ?? null,
        passed: plan?.passed ?? null,
        costUsd: Number(cost?.sum ?? 0),
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
      });
    }
    return out;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("runs")
    .select("id, user_id, input_text, level, status, screen_json, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const out: AdminRunRow[] = [];
  for (const r of data || []) {
    const { data: planRows } = await sb
      .from("plans")
      .select("attempt, passed")
      .eq("run_id", r.id)
      .order("attempt", { ascending: false })
      .limit(1);
    const { data: costRows } = await sb
      .from("llm_calls")
      .select("cost_usd")
      .eq("run_id", r.id);
    const screen = r.screen_json as {
      screen?: { role_title?: string; industry?: string };
    } | null;
    out.push({
      id: r.id as string,
      userId: r.user_id as string,
      inputText: String(r.input_text || "").slice(0, 160),
      level: r.level as string,
      status: r.status as string,
      roleTitle: screen?.screen?.role_title ?? null,
      industry: screen?.screen?.industry ?? null,
      attempt: planRows?.[0]?.attempt ?? null,
      passed: planRows?.[0]?.passed ?? null,
      costUsd: (costRows || []).reduce(
        (s, c) => s + (Number(c.cost_usd) || 0),
        0,
      ),
      createdAt: String(r.created_at),
    });
  }
  return out;
}

export async function roleStats(): Promise<AdminRoleStats[]> {
  const rows = await listAdminRuns(200);
  const byRole = new Map<
    string,
    {
      runs: number;
      ready: number;
      costs: number[];
      scores: number[];
      games: number;
      scored: number;
    }
  >();

  for (const r of rows) {
    const role = r.roleTitle || "(unscreened)";
    const bucket = byRole.get(role) || {
      runs: 0,
      ready: 0,
      costs: [],
      scores: [],
      games: 0,
      scored: 0,
    };
    bucket.runs += 1;
    if (r.status === "ready") bucket.ready += 1;
    bucket.costs.push(r.costUsd);
    byRole.set(role, bucket);
  }

  if (hasDbAccess()) {
    if (usePg()) {
      const db = getDb();
      const gameRows = await db
        .select({
          status: games.status,
          total: scores.total,
          runId: games.runId,
        })
        .from(games)
        .leftJoin(scores, eq(scores.gameId, games.id))
        .limit(400);
      const runRole = new Map(
        rows.map((r) => [r.id, r.roleTitle || "(unscreened)"]),
      );
      for (const g of gameRows) {
        const role = runRole.get(g.runId) || "(unscreened)";
        const bucket = byRole.get(role) || {
          runs: 0,
          ready: 0,
          costs: [],
          scores: [],
          games: 0,
          scored: 0,
        };
        bucket.games += 1;
        if (g.status === "scored") {
          bucket.scored += 1;
          if (g.total != null) bucket.scores.push(Number(g.total));
        }
        byRole.set(role, bucket);
      }
    }
  }

  return [...byRole.entries()]
    .map(([role, b]) => ({
      role,
      runs: b.runs,
      ready: b.ready,
      passRate: b.runs ? b.ready / b.runs : 0,
      games: b.games,
      scored: b.scored,
      completionRate: b.games ? b.scored / b.games : 0,
      medianScore: median(b.scores),
      medianCost: median(b.costs),
    }))
    .sort((a, b) => b.runs - a.runs);
}
