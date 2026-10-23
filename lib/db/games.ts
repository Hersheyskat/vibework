import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { games, plans, runs } from "@/lib/db/schema";
import type { ScenarioBundle } from "@/lib/scenario/schema";
import type { GameState } from "@/lib/try/engine/types";
import { freshGameState } from "@/lib/try/engine/types";

function usePg() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export type GameRow = {
  id: string;
  userId: string;
  runId: string;
  planId: string;
  state: GameState;
  status: string;
};

export async function getPassingPlanBundle(
  runId: string,
): Promise<{ planId: string; bundle: ScenarioBundle } | null> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.runId, runId), eq(plans.passed, true)))
      .orderBy(desc(plans.attempt))
      .limit(1);
    if (!row) return null;
    return {
      planId: row.id,
      bundle: row.bundleJson as ScenarioBundle,
    };
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("plans")
    .select("id, bundle_json")
    .eq("run_id", runId)
    .eq("passed", true)
    .order("attempt", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    planId: data.id as string,
    bundle: data.bundle_json as ScenarioBundle,
  };
}

export async function createGame(opts: {
  userId: string;
  runId: string;
  planId: string;
  bundle: ScenarioBundle;
}): Promise<string> {
  const state = freshGameState(opts.bundle);
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .insert(games)
      .values({
        userId: opts.userId,
        runId: opts.runId,
        planId: opts.planId,
        stateJson: state,
        status: "playing",
      })
      .returning({ id: games.id });
    return row!.id;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .insert({
      user_id: opts.userId,
      run_id: opts.runId,
      plan_id: opts.planId,
      state_json: state,
      status: "playing",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "create game failed");
  return data.id as string;
}

export async function getGameForUser(
  gameId: string,
  userId: string,
): Promise<GameRow | null> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(games)
      .where(and(eq(games.id, gameId), eq(games.userId, userId)))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      runId: row.runId,
      planId: row.planId,
      state: row.stateJson as GameState,
      status: row.status,
    };
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("games")
    .select("*")
    .eq("id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id as string,
    userId: data.user_id as string,
    runId: data.run_id as string,
    planId: data.plan_id as string,
    state: data.state_json as GameState,
    status: data.status as string,
  };
}

export async function saveGameState(gameId: string, state: GameState) {
  if (usePg()) {
    const db = getDb();
    await db
      .update(games)
      .set({ stateJson: state })
      .where(eq(games.id, gameId));
    return;
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("games")
    .update({ state_json: state })
    .eq("id", gameId);
  if (error) throw new Error(error.message);
}

export async function getPlanBundle(
  planId: string,
): Promise<ScenarioBundle | null> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);
    return (row?.bundleJson as ScenarioBundle) ?? null;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("plans")
    .select("bundle_json")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.bundle_json as ScenarioBundle) ?? null;
}

export async function getRunLevel(runId: string): Promise<string | null> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .select({ level: runs.level })
      .from(runs)
      .where(eq(runs.id, runId))
      .limit(1);
    return row?.level ?? null;
  }
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("runs")
    .select("level")
    .eq("id", runId)
    .maybeSingle();
  return (data?.level as string) ?? null;
}
