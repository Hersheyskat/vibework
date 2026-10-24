import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getSupabaseAdmin, hasDbAccess } from "@/lib/db/admin";
import { events, plans, readyDays, runs } from "@/lib/db/schema";
import type { ScenarioBundle } from "@/lib/scenario/schema";

/** System owner for shelf seed runs (not a real learner). */
export const SHELF_SYSTEM_USER = "00000000-0000-4000-8000-0000000000ef";

function usePg() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export type ReadyDayRow = {
  id: string;
  roleKey: string;
  level: string;
  planId: string | null;
  variant: number;
  servedCount: number;
};

export async function listReadyDays(
  roleKey: string,
  level: string,
): Promise<ReadyDayRow[]> {
  if (!hasDbAccess()) return [];
  if (usePg()) {
    const db = getDb();
    const rows = await db
      .select()
      .from(readyDays)
      .where(and(eq(readyDays.roleKey, roleKey), eq(readyDays.level, level)));
    return rows.map((r) => ({
      id: r.id,
      roleKey: r.roleKey,
      level: r.level,
      planId: r.planId,
      variant: r.variant,
      servedCount: r.servedCount,
    }));
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("ready_days")
    .select("id, role_key, level, plan_id, variant, served_count")
    .eq("role_key", roleKey)
    .eq("level", level);
  if (error) throw new Error(error.message);
  return (data || []).map((r) => ({
    id: r.id as string,
    roleKey: r.role_key as string,
    level: r.level as string,
    planId: (r.plan_id as string) || null,
    variant: r.variant as number,
    servedCount: r.served_count as number,
  }));
}

export async function listAllShelfRoleKeys(): Promise<string[]> {
  if (!hasDbAccess()) return [];
  if (usePg()) {
    const db = getDb();
    const rows = await db.select({ roleKey: readyDays.roleKey }).from(readyDays);
    return [...new Set(rows.map((r) => r.roleKey))];
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("ready_days").select("role_key");
  if (error) throw new Error(error.message);
  return [...new Set((data || []).map((r) => r.role_key as string))];
}

export async function servedReadyDayIdsForUser(
  userId: string,
): Promise<Set<string>> {
  if (!hasDbAccess()) return new Set();
  if (usePg()) {
    const db = getDb();
    const rows = await db
      .select()
      .from(events)
      .where(
        and(eq(events.userId, userId), eq(events.name, "shelf_served")),
      );
    const ids = new Set<string>();
    for (const r of rows) {
      const props = r.propsJson as { readyDayId?: string };
      if (props?.readyDayId) ids.add(props.readyDayId);
    }
    return ids;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("events")
    .select("props_json")
    .eq("user_id", userId)
    .eq("name", "shelf_served");
  if (error) throw new Error(error.message);
  const ids = new Set<string>();
  for (const r of data || []) {
    const props = r.props_json as { readyDayId?: string };
    if (props?.readyDayId) ids.add(props.readyDayId);
  }
  return ids;
}

export async function getPlanBundleById(
  planId: string,
): Promise<ScenarioBundle | null> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);
    return row ? (row.bundleJson as ScenarioBundle) : null;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("plans")
    .select("bundle_json")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? (data.bundle_json as ScenarioBundle) : null;
}

export async function bumpServed(readyDayId: string, userId: string) {
  if (usePg()) {
    const db = getDb();
    await db
      .update(readyDays)
      .set({ servedCount: sql`${readyDays.servedCount} + 1` })
      .where(eq(readyDays.id, readyDayId));
    await db.insert(events).values({
      userId,
      name: "shelf_served",
      propsJson: { readyDayId },
    });
    return;
  }
  const sb = getSupabaseAdmin();
  const { data: row } = await sb
    .from("ready_days")
    .select("served_count")
    .eq("id", readyDayId)
    .maybeSingle();
  await sb
    .from("ready_days")
    .update({ served_count: ((row?.served_count as number) || 0) + 1 })
    .eq("id", readyDayId);
  await sb.from("events").insert({
    user_id: userId,
    name: "shelf_served",
    props_json: { readyDayId },
  });
}

export async function countReadyDays(): Promise<number> {
  if (!hasDbAccess()) return 0;
  if (usePg()) {
    const db = getDb();
    const rows = await db.select({ id: readyDays.id }).from(readyDays);
    return rows.length;
  }
  const sb = getSupabaseAdmin();
  const { count, error } = await sb
    .from("ready_days")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return count || 0;
}

export async function insertShelfPlan(opts: {
  runId: string;
  bundle: ScenarioBundle;
  promptVersion: string;
}): Promise<string> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .insert(plans)
      .values({
        runId: opts.runId,
        attempt: 1,
        mode: "fresh",
        bundleJson: opts.bundle,
        checksJson: [],
        auditJson: null,
        passed: true,
        promptVersion: opts.promptVersion,
        model: "shelf-seed",
      })
      .returning({ id: plans.id });
    return row!.id;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("plans")
    .insert({
      run_id: opts.runId,
      attempt: 1,
      mode: "fresh",
      bundle_json: opts.bundle,
      checks_json: [],
      audit_json: null,
      passed: true,
      prompt_version: opts.promptVersion,
      model: "shelf-seed",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "shelf plan insert");
  return data.id as string;
}

export async function insertReadyDay(opts: {
  roleKey: string;
  level: string;
  planId: string;
  variant: number;
}): Promise<string> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .insert(readyDays)
      .values({
        roleKey: opts.roleKey,
        level: opts.level,
        planId: opts.planId,
        variant: opts.variant,
        servedCount: 0,
      })
      .returning({ id: readyDays.id });
    return row!.id;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("ready_days")
    .insert({
      role_key: opts.roleKey,
      level: opts.level,
      plan_id: opts.planId,
      variant: opts.variant,
      served_count: 0,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "ready_day insert");
  return data.id as string;
}

export async function ensureShelfSystemRun(): Promise<string> {
  if (usePg()) {
    const db = getDb();
    const existing = await db
      .select()
      .from(runs)
      .where(eq(runs.userId, SHELF_SYSTEM_USER))
      .limit(1);
    if (existing[0]) return existing[0].id;
    const [row] = await db
      .insert(runs)
      .values({
        userId: SHELF_SYSTEM_USER,
        inputText: "[shelf seed]",
        level: "medium",
        status: "ready",
        currentStep: "shelf",
        screenJson: {},
      })
      .returning({ id: runs.id });
    return row!.id;
  }
  const sb = getSupabaseAdmin();
  const { data: existing } = await sb
    .from("runs")
    .select("id")
    .eq("user_id", SHELF_SYSTEM_USER)
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;
  const { data, error } = await sb
    .from("runs")
    .insert({
      user_id: SHELF_SYSTEM_USER,
      input_text: "[shelf seed]",
      level: "medium",
      status: "ready",
      current_step: "shelf",
      screen_json: {},
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "shelf run insert");
  return data.id as string;
}
