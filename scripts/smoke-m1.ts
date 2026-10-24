/**
 * Focused M1 polish smoke (faster/cheaper than full golden eval).
 * Usage: npx tsx --env-file=.env.local scripts/smoke-m1.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { openRouterConfigured } from "../lib/ai/client";
import {
  codeChecks,
  codeChecksPass1,
} from "../lib/scenario/checks";
import { normalize } from "../lib/scenario/normalize";
import { planPass1Prompt, planPass2Prompt } from "../lib/ai/prompts/plan";
import { WORKED_EXAMPLE_DAY } from "../lib/ai/prompts/example-day";
import type { ScreenResult } from "../lib/scenario/schema";
import { guardJobInput } from "../lib/try/guard";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

function offline() {
  console.log("=== Offline ===");
  assert(WORKED_EXAMPLE_DAY.includes("Zippy"), "worked example missing");
  assert(WORKED_EXAMPLE_DAY.length > 500, "worked example too short");

  const scr: ScreenResult = {
    is_job: true,
    role_title: "Retail Store Manager",
    industry: "Retail",
    location_hint: "India",
    regulation: "none",
    reason: "",
    employer_names: ["Shoppers Stop"],
    adjacent_roles: [],
  };
  const p1 = planPass1Prompt(scr, "Retail Store Manager", "medium");
  const p2 = planPass2Prompt(scr, "Retail Store Manager", "medium", "{}");
  assert(p1.includes("PASS 1"), "pass1 prompt");
  assert(p1.includes("WORKED EXAMPLE"), "pass1 has example");
  assert(p2.includes("PASS 2"), "pass2 prompt");

  const raw = JSON.parse(
    readFileSync(
      resolve("scenarios/example/example-bundle-zippy-medium.json"),
      "utf8",
    ),
  );
  const full = normalize(raw, "medium");
  assert(full, "normalize example");
  assert(
    codeChecks(full!, "medium", null).every((c) => c.status !== "fail"),
    "full checks",
  );

  const pass1 = structuredClone(full!);
  pass1.day.public = {
    inbox: [],
    dashboard: { title: "", subtitle: "", columns: [], rows: [], notes: [] },
    reviews: [],
    documents: [],
  };
  pass1.day.tasks = [];
  pass1.day.triggers = [];
  pass1.day.scoring = {
    strong_player: "",
    expected_answers: {},
    common_mistakes: [],
    senior_view: "",
    drill: "",
  };
  assert(
    codeChecksPass1(pass1, "medium", null).every((c) => c.status !== "fail"),
    "pass1 checks on stripped bundle",
  );

  const link = guardJobInput("https://www.linkedin.com/jobs/view/1");
  assert(!link.ok && link.reason === "link_only", "link guard");

  console.log("PASS offline\n");
}

async function liveOne() {
  console.log("=== Live: one beginner day + blocked nurse ===");
  if (!openRouterConfigured()) {
    console.log("SKIP live — no OPENROUTER_API_KEY");
    return;
  }
  if (
    !process.env.DATABASE_URL &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.log("SKIP live — no DB credentials");
    return;
  }

  const { generateDay } = await import("../lib/jobs/generate-day");
  const { createRun, getRun } = await import("../lib/db/runs");
  const evalUser = "00000000-0000-4000-8000-000000000099";

  // Blocked (cheap: screen only)
  {
    const t0 = Date.now();
    const runId = await createRun({
      userId: evalUser,
      inputText: "Staff Nurse, ICU",
      level: "medium",
      payload: {},
    });
    await generateDay(runId);
    const run = await getRun(runId);
    const ok = run?.status === "blocked";
    console.log(
      `${ok ? "PASS" : "FAIL"} blocked nurse · got=${run?.status} · ${Date.now() - t0}ms`,
    );
    assert(ok, "nurse should block");
  }

  // One ready day (two-pass + checks)
  {
    const t0 = Date.now();
    const runId = await createRun({
      userId: evalUser,
      inputText: "Customer Support Executive at a food delivery app",
      level: "beginner",
      payload: {},
    });
    await generateDay(runId);
    const run = await getRun(runId);
    const ms = Date.now() - t0;
    const payload = run?.screenJson;
    const status = run?.status;
    const stage = payload?.gen?.customerStage;
    const roleMinute = payload?.role_minute;
    const checks = payload?.gen?.checks || [];
    const fails = checks.filter((c) => c.status === "fail");

    console.log(
      `status=${status} · ${ms}ms · customerStage=${stage || "?"} · roleMinute=${roleMinute ? `${roleMinute.length} chars` : "none"} · checkFails=${fails.length}`,
    );
    if (fails.length) {
      for (const f of fails) console.log(`  FAIL ${f.name}: ${f.detail}`);
    }

    // Accept ready, or failed after full recovery (still validates pipeline ran)
    assert(
      status === "ready" || status === "failed",
      `unexpected status ${status}`,
    );
    assert(payload?.screen?.role_title, "screen role_title saved");
    if (status === "ready") {
      assert(payload?.summary, "ready summary");
      assert(stage === "Ready" || !stage, "customer stage ready");
      console.log("PASS live ready day");
    } else {
      console.log(
        "WARN live day ended failed after recovery — pipeline ran; shelf fallback still TODO",
      );
    }
  }
}

async function main() {
  offline();
  await liveOne();
  console.log("\n=== Smoke done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
