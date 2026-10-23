import { NextResponse } from "next/server";
import { getPassingPlan, getRunForUser, type RunPayload } from "@/lib/db/runs";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const run = await getRunForUser(id, user.id);
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const tester = url.searchParams.get("tester") === "1";
  const payload = (run.screenJson || {}) as RunPayload;

  const body: Record<string, unknown> = {
    id: run.id,
    status: run.status,
    currentStep: run.currentStep,
    level: run.level,
    createdAt: run.createdAt,
    regulationBanner: payload.regulation_banner ?? null,
    adjacentRoles: payload.adjacent_roles ?? [],
    screen: payload.screen
      ? {
          is_job: payload.screen.is_job,
          role_title: payload.screen.role_title,
          industry: payload.screen.industry,
          location_hint: payload.screen.location_hint,
          regulation: payload.screen.regulation,
          reason: payload.screen.reason,
          adjacent_roles: payload.screen.adjacent_roles,
        }
      : null,
    summary: run.status === "ready" ? payload.summary ?? null : null,
    gen: payload.gen
      ? {
          status: payload.gen.status,
          step: payload.gen.step,
          attempt: payload.gen.attempt,
          mode: payload.gen.mode,
          stage: payload.gen.stage,
          err: payload.gen.err,
          // M1: full check report (tester-style). Friendly customer stages in M2.
          checks: payload.gen.checks,
          audit: payload.gen.audit,
        }
      : null,
  };

  if (tester && run.status === "ready") {
    const plan = await getPassingPlan(run.id);
    body.planId = plan?.id ?? null;
  }

  return NextResponse.json(body);
}
