import { after } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { openRouterConfigured } from "@/lib/ai/client";
import { trackEvent } from "@/lib/analytics/track";
import { hasDbAccess } from "@/lib/db";
import { createRun } from "@/lib/db/runs";
import { inngest, inngestConfigured } from "@/lib/inngest/client";
import { generateDay } from "@/lib/jobs/generate-day";
import { getAllowance } from "@/lib/limits/caps";
import {
  alertBudgetIfNeeded,
  getBudgetStatus,
} from "@/lib/limits/budget";
import { createClient } from "@/lib/supabase/server";
import { guardJobInput } from "@/lib/try/guard";
import type { LevelId } from "@/lib/try/levels";

const bodySchema = z.object({
  input: z.string(),
  level: z.enum(["beginner", "medium", "advanced"]),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  if (!openRouterConfigured()) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not set on the server" },
      { status: 503 },
    );
  }

  if (!hasDbAccess()) {
    return NextResponse.json(
      {
        error:
          "Set DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local so runs can be saved",
      },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const guarded = guardJobInput(parsed.data.input);
  if (!guarded.ok) {
    return NextResponse.json(
      {
        error:
          guarded.reason === "link_only"
            ? "Paste the job description, not just a link. Job sites need a login, so we can't fetch the page."
            : "Paste a job post or type a role first.",
        code: guarded.reason,
      },
      { status: 400 },
    );
  }

  const budget = await getBudgetStatus();
  if (!budget.ok) {
    await alertBudgetIfNeeded(budget);
    await trackEvent("budget_paused", {
      spentUsd: budget.spentUsd,
      ceilingUsd: budget.ceilingUsd,
    }, user.id);
    return NextResponse.json(
      { error: budget.reason, code: "budget_paused" },
      { status: 503 },
    );
  }

  const allowance = await getAllowance(user.id);
  if (!allowance.ok) {
    return NextResponse.json(
      {
        error: allowance.reason,
        code: "cap_reached",
        allowance,
      },
      { status: 429 },
    );
  }

  const level = parsed.data.level as LevelId;
  const runId = await createRun({
    userId: user.id,
    inputText: guarded.text,
    level,
    payload: {
      gen: {
        status: "running",
        step: "queued",
        attempt: 0,
        checks: [],
        audit: null,
        err: null,
        stage: {},
      },
    },
  });

  await trackEvent(
    "job_submitted",
    {
      level,
      inputLength: guarded.text.length,
      pasted:
        guarded.text.includes("\n") || guarded.text.split(" ").length > 8,
    },
    user.id,
  );

  if (inngestConfigured()) {
    await inngest.send({
      name: "try/generate.requested",
      data: { runId },
    });
  } else {
    // Local / preview without Inngest: run after the response is sent.
    after(async () => {
      try {
        await generateDay(runId);
      } catch (e) {
        console.error("generateDay failed", runId, e);
      }
    });
  }

  return NextResponse.json({ id: runId, allowance });
}
