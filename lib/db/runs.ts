import { and, eq } from "drizzle-orm";
import { getDb, hasDbAccess } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { plans, runs } from "@/lib/db/schema";
import type { CheckResult } from "@/lib/scenario/checks";
import type { ScenarioBundle, ScreenResult } from "@/lib/scenario/schema";

export type RunStatus =
  | "guarding"
  | "screening"
  | "planning"
  | "checking"
  | "repairing"
  | "ready"
  | "failed"
  | "blocked";

export type GenProgress = {
  status: "running" | "done" | "failed";
  step: string;
  attempt: number;
  mode?: "fresh" | "repair";
  checks: CheckResult[];
  audit: { ok: boolean; issues: { severity: string; text: string }[] } | null;
  err: string | null;
  structural?: boolean;
  stage: Record<string, string>;
  /** Plain-language stage for customers (never "failed" / check names). */
  customerStage?: string;
};

export type ShelfOfferPayload = {
  roleKey: string;
  label: string;
  message: string;
  readyDayId: string;
  variant: number;
  fromShelf: true;
};

export type RunPayload = {
  screen?: ScreenResult | null;
  gen?: GenProgress;
  summary?: unknown;
  adjacent_roles?: string[];
  regulation_banner?: string | null;
  /** Haiku “your role in a minute” while building. */
  role_minute?: string | null;
  /** Nearest ready-made day offered after recovery (BRIEF shelf). */
  shelf_offer?: ShelfOfferPayload | null;
};

export type RunRow = {
  id: string;
  userId: string;
  inputText: string;
  level: string;
  status: string;
  currentStep: string | null;
  screenJson: RunPayload | null;
  createdAt: Date | string;
};

function usePg(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function mapRow(r: Record<string, unknown>): RunRow {
  return {
    id: String(r.id),
    userId: String(r.user_id ?? r.userId),
    inputText: String(r.input_text ?? r.inputText),
    level: String(r.level),
    status: String(r.status),
    currentStep: (r.current_step ?? r.currentStep ?? null) as string | null,
    screenJson: (r.screen_json ?? r.screenJson ?? null) as RunPayload | null,
    createdAt: (r.created_at ?? r.createdAt) as Date | string,
  };
}

export async function createRun(opts: {
  userId: string;
  inputText: string;
  level: string;
  payload: RunPayload;
}): Promise<string> {
  if (!hasDbAccess()) {
    throw new Error("Set DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .insert(runs)
      .values({
        userId: opts.userId,
        inputText: opts.inputText,
        level: opts.level,
        status: "guarding",
        currentStep: "queued",
        screenJson: opts.payload,
      })
      .returning({ id: runs.id });
    return row!.id;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("runs")
    .insert({
      user_id: opts.userId,
      input_text: opts.inputText,
      level: opts.level,
      status: "guarding",
      current_step: "queued",
      screen_json: opts.payload,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "insert run failed");
  return data.id as string;
}

export async function getRun(runId: string): Promise<RunRow | null> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
    return row
      ? {
          id: row.id,
          userId: row.userId,
          inputText: row.inputText,
          level: row.level,
          status: row.status,
          currentStep: row.currentStep,
          screenJson: row.screenJson as RunPayload | null,
          createdAt: row.createdAt,
        }
      : null;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function getRunForUser(
  runId: string,
  userId: string,
): Promise<RunRow | null> {
  const row = await getRun(runId);
  if (!row || row.userId !== userId) return null;
  return row;
}

export async function updateRun(
  runId: string,
  patch: {
    status?: RunStatus;
    currentStep?: string;
    payload?: RunPayload;
  },
) {
  const existing = await getRun(runId);
  const prev = existing?.screenJson || {};
  const nextPayload = patch.payload ? { ...prev, ...patch.payload } : prev;

  if (usePg()) {
    const db = getDb();
    await db
      .update(runs)
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.currentStep !== undefined
          ? { currentStep: patch.currentStep }
          : {}),
        screenJson: nextPayload,
      })
      .where(eq(runs.id, runId));
    return;
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("runs")
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.currentStep !== undefined
        ? { current_step: patch.currentStep }
        : {}),
      screen_json: nextPayload,
    })
    .eq("id", runId);
  if (error) throw new Error(error.message);
}

export async function insertPlan(opts: {
  runId: string;
  attempt: number;
  mode: "fresh" | "repair";
  bundle: ScenarioBundle;
  checks: CheckResult[];
  audit: unknown;
  passed: boolean;
  promptVersion: string;
  model: string;
}): Promise<string> {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .insert(plans)
      .values({
        runId: opts.runId,
        attempt: opts.attempt,
        mode: opts.mode,
        bundleJson: opts.bundle,
        checksJson: opts.checks,
        auditJson: opts.audit,
        passed: opts.passed,
        promptVersion: opts.promptVersion,
        model: opts.model,
      })
      .returning({ id: plans.id });
    return row!.id;
  }

  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("plans")
    .insert({
      run_id: opts.runId,
      attempt: opts.attempt,
      mode: opts.mode,
      bundle_json: opts.bundle,
      checks_json: opts.checks,
      audit_json: opts.audit,
      passed: opts.passed,
      prompt_version: opts.promptVersion,
      model: opts.model,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "insert plan failed");
  return data.id as string;
}

export async function getPassingPlan(runId: string) {
  if (usePg()) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.runId, runId), eq(plans.passed, true)))
      .limit(1);
    return row ?? null;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("plans")
    .select("id")
    .eq("run_id", runId)
    .eq("passed", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}
