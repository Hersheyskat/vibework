import { NextResponse } from "next/server";
import { getPassingPlan, getRunForUser, type RunPayload } from "@/lib/db/runs";
import { createClient } from "@/lib/supabase/server";

type Ctx = { params: Promise<{ id: string }> };

function isTester(req: Request): boolean {
  const url = new URL(req.url);
  if (url.searchParams.get("tester") === "1") return true;
  if (process.env.VIBEWORK_TESTER === "1") return true;
  return false;
}

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

  const tester = isTester(req);
  const payload = (run.screenJson || {}) as RunPayload;
  const gen = payload.gen;
  const shelf = payload.shelf_offer ?? null;

  const body: Record<string, unknown> = {
    id: run.id,
    status:
      !tester && run.status === "failed" ? "recovering" : run.status,
    currentStep: run.currentStep,
    level: run.level,
    createdAt: run.createdAt,
    regulationBanner: payload.regulation_banner ?? null,
    adjacentRoles: payload.adjacent_roles ?? [],
    roleMinute: payload.role_minute ?? null,
    shelfOffer: shelf
      ? {
          label: shelf.label,
          message: shelf.message,
          fromShelf: true as const,
        }
      : null,
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
    gen: gen
      ? {
          status:
            !tester && gen.status === "failed" ? "running" : gen.status,
          step: gen.step,
          attempt: gen.attempt,
          mode: tester ? gen.mode : undefined,
          stage: tester ? gen.stage : undefined,
          customerStage:
            gen.customerStage ||
            (run.status === "ready"
              ? "Ready"
              : run.status === "failed"
                ? "Taking longer than usual"
                : "Building your work-day"),
          ...(tester
            ? {
                err: gen.err,
                checks: gen.checks,
                audit: gen.audit,
                structural: gen.structural,
              }
            : {
                err: null,
                checks: [],
                audit: null,
              }),
        }
      : null,
    tester,
  };

  if (tester && run.status === "ready") {
    const plan = await getPassingPlan(run.id);
    body.planId = plan?.id ?? null;
  }

  if (!tester && run.status === "failed") {
    body.customerFallback = {
      message:
        "Your exact role needs a little longer. Try again with a shorter job post, or pick an example role — we'll keep improving this one.",
      actions: ["try_again", "change_job"],
    };
  }

  return NextResponse.json(body);
}
