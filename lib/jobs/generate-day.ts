import { z } from "zod";
import { completeJson, completeText } from "@/lib/ai/client";
import { AiError, copyFor } from "@/lib/ai/errors";
import { auditPrompt, AUDIT_PROMPT_VERSION } from "@/lib/ai/prompts/audit";
import {
  planPass1Prompt,
  planPass2Prompt,
  PLAN_PASS1_VERSION,
  PLAN_PASS2_VERSION,
  PLAN_PROMPT_VERSION,
} from "@/lib/ai/prompts/plan";
import { repairPrompt, REPAIR_PROMPT_VERSION } from "@/lib/ai/prompts/repair";
import {
  roleMinutePrompt,
  ROLE_MINUTE_PROMPT_VERSION,
} from "@/lib/ai/prompts/role-minute";
import { screenPrompt, SCREEN_PROMPT_VERSION } from "@/lib/ai/prompts/screen";
import {
  codeChecks,
  codeChecksPass1,
  failingReasons,
  hasPass1StructuralFail,
  hasStructuralFail,
  isProperEmployerName,
  type CheckResult,
} from "@/lib/scenario/checks";
import { coerceBundle } from "@/lib/scenario/coerce";
import { normalize } from "@/lib/scenario/normalize";
import { publicReadySummary } from "@/lib/scenario/public-summary";
import {
  auditResultSchema,
  screenResultSchema,
  type ScenarioBundle,
  type ScreenResult,
} from "@/lib/scenario/schema";
import {
  getRun,
  insertPlan,
  updateRun,
  type GenProgress,
} from "@/lib/db/runs";
import { trackEvent } from "@/lib/analytics/track";
import { tryOfferShelf } from "@/lib/shelf/offer";
import { BLOCK_KW, type LevelId } from "@/lib/try/levels";
import { todaySpendUsd } from "@/lib/limits/budget";

/** Very loose — normalize() + codeChecks are the real validators. */
const looseBundle = z
  .object({
    track: z.unknown(),
    day: z.unknown(),
    ledger: z.unknown().optional(),
    claims: z.unknown().optional(),
  })
  .passthrough();

async function setGen(
  runId: string,
  status: Parameters<typeof updateRun>[1]["status"],
  step: string,
  gen: GenProgress,
  extra?: Parameters<typeof updateRun>[1]["payload"],
) {
  await updateRun(runId, {
    status,
    currentStep: step,
    payload: { gen, ...extra },
  });
}

function customerStageFor(step: string, attempt: number): string {
  if (step === "screen" || step === "blocked") return "Reading your job";
  if (step === "role_minute") return "Your role in a minute";
  if (step === "plan" || step === "plan1") return "Setting up your company";
  if (step === "plan2") return "Hiring your team";
  if (step === "check" || step === "audit") return "Preparing this week's data";
  if (step === "repair")
    return attempt > 1
      ? "Tuning the day"
      : "Preparing this week's data";
  if (step === "ready") return "Ready";
  return "Building your work-day";
}

/** BRIEF silent recovery end: shelf offer, else mark failed (tester-only wording). */
async function failOrShelf(opts: {
  runId: string;
  userId: string;
  level: LevelId;
  scr: ScreenResult;
  gen: GenProgress;
  regulationBanner: string | null;
  roleMinute: string | null;
  err: string;
  structural?: boolean;
  step: string;
}): Promise<void> {
  try {
    const offer = await tryOfferShelf({
      runId: opts.runId,
      userId: opts.userId,
      level: opts.level,
      scr: opts.scr,
      gen: opts.gen,
      regulationBanner: opts.regulationBanner,
      roleMinute: opts.roleMinute,
    });
    if (offer) return;
  } catch {
    // Fall through to failed
  }
  const gen: GenProgress = {
    ...opts.gen,
    status: "failed",
    err: opts.err,
    structural: opts.structural,
    customerStage: "Taking longer than usual",
  };
    await setGen(opts.runId, "failed", opts.step, gen, {
    screen: opts.scr,
    regulation_banner: opts.regulationBanner,
    role_minute: opts.roleMinute,
    shelf_offer: null,
  });
  await trackEvent(
    "run_finished",
    {
      ready: false,
      outcome: "failed",
      cost: await todaySpendUsd().catch(() => 0),
    },
    opts.userId,
  );
}

async function planTwoPass(opts: {
  runId: string;
  scr: ScreenResult;
  input: string;
  level: LevelId;
  gen: GenProgress;
  regulationBanner: string | null;
  issues: string[] | null;
}): Promise<{
  bundle: ScenarioBundle;
  model: string;
  gen: GenProgress;
  pass1Failed?: string[];
}> {
  let gen = {
    ...opts.gen,
    step: "plan1",
    customerStage: customerStageFor("plan1", opts.gen.attempt),
  };
  await setGen(opts.runId, "planning", "plan1", gen, {
    screen: opts.scr,
    regulation_banner: opts.regulationBanner,
  });

  const pass1 = await completeJson({
    job: "plan",
    purpose: "plan_pass1",
    promptVersion: PLAN_PASS1_VERSION,
    runId: opts.runId,
    maxTokens: 12000,
    messages: [
      {
        role: "user",
        content:
          planPass1Prompt(opts.scr, opts.input, opts.level) +
          (opts.issues?.length
            ? `\n\nEarlier attempt failed:\n- ${opts.issues.join("\n- ")}\nFix those in this Pass 1 core.\n`
            : ""),
      },
    ],
    schema: looseBundle,
  });

  const pass1Bundle = normalize(coerceBundle(pass1.data), opts.level);
  if (!pass1Bundle) {
    throw new AiError(
      "invalid_json",
      "Pass 1 was not a valid scenario core.",
    );
  }

  const p1Checks = codeChecksPass1(pass1Bundle, opts.level, opts.scr);
  const p1Fails = failingReasons(p1Checks);
  gen = {
    ...gen,
    checks: p1Checks,
    stage: { ...gen.stage, plan1: p1Fails.length ? "bad" : "ok" },
  };

  if (p1Fails.length && hasPass1StructuralFail(p1Checks)) {
    await insertPlan({
      runId: opts.runId,
      attempt: opts.gen.attempt,
      mode: "fresh",
      bundle: pass1Bundle,
      checks: p1Checks,
      audit: null,
      passed: false,
      promptVersion: PLAN_PASS1_VERSION,
      model: pass1.model,
    });
    return {
      bundle: pass1Bundle,
      model: pass1.model,
      gen,
      pass1Failed: p1Fails,
    };
  }

  gen = {
    ...gen,
    step: "plan2",
    customerStage: customerStageFor("plan2", opts.gen.attempt),
  };
  await setGen(opts.runId, "planning", "plan2", gen, {
    screen: opts.scr,
    regulation_banner: opts.regulationBanner,
  });

  const pass1Json = JSON.stringify({
    track: pass1Bundle.track,
    day: {
      ...pass1Bundle.day,
      public: pass1Bundle.day.public,
      characters: pass1Bundle.day.characters,
      tasks: [],
      triggers: [],
      scoring: pass1Bundle.day.scoring,
    },
    ledger: pass1Bundle.ledger,
    claims: pass1Bundle.claims,
  });

  const pass2 = await completeJson({
    job: "plan",
    purpose: "plan_pass2",
    promptVersion: PLAN_PASS2_VERSION,
    runId: opts.runId,
    maxTokens: 16000,
    messages: [
      {
        role: "user",
        content: planPass2Prompt(
          opts.scr,
          opts.input,
          opts.level,
          pass1Json,
        ),
      },
    ],
    schema: looseBundle,
  });

  const bundle = normalize(coerceBundle(pass2.data), opts.level);
  if (!bundle) {
    throw new AiError(
      "invalid_json",
      "Pass 2 was not a valid full scenario.",
    );
  }

  return {
    bundle,
    model: pass2.model,
    gen: {
      ...gen,
      stage: { ...gen.stage, plan2: "ok" },
      customerStage: customerStageFor("check", opts.gen.attempt),
    },
  };
}

export async function generateDay(runId: string): Promise<void> {
  const run = await getRun(runId);
  if (!run) throw new Error(`run ${runId} not found`);

  const level = run.level as LevelId;
  const input = run.inputText;
  const userId = run.userId;
  let gen: GenProgress = {
    status: "running",
    step: "screen",
    attempt: 0,
    checks: [],
    audit: null,
    err: null,
    stage: {},
    customerStage: customerStageFor("screen", 0),
  };

  await setGen(runId, "screening", "screen", gen);

  let scr: ScreenResult;
  try {
    const { data } = await completeJson({
      job: "screen",
      purpose: "screen",
      promptVersion: SCREEN_PROMPT_VERSION,
      runId,
      messages: [{ role: "user", content: screenPrompt(input) }],
      schema: screenResultSchema,
    });
    scr = data;
  } catch (e) {
    const msg =
      e instanceof AiError ? e.message : copyFor("invalid_json");
    gen = {
      ...gen,
      status: "failed",
      err: msg,
      structural: true,
      customerStage: "Taking longer than usual",
    };
    await setGen(runId, "failed", "screen", gen);
    await trackEvent(
      "run_finished",
      { ready: false, outcome: "failed", step: "screen" },
      userId,
    );
    return;
  }

  if (BLOCK_KW.test(scr.role_title || "") && scr.regulation === "none") {
    scr = { ...scr, regulation: "flag" };
  }
  scr = {
    ...scr,
    employer_names: (scr.employer_names || []).filter(isProperEmployerName),
  };

  gen = {
    ...gen,
    stage: { ...gen.stage, screen: "ok" },
    customerStage: customerStageFor("role_minute", 0),
  };
  await updateRun(runId, {
    payload: { screen: scr, gen },
  });

  if (scr.is_job === false) {
    gen = {
      ...gen,
      status: "failed",
      structural: true,
      err:
        (scr.reason ? scr.reason + " " : "") +
        "Paste the job description text, or type a role such as 'Retail Store Manager'.",
      customerStage: "Need a clearer job",
    };
    await setGen(runId, "failed", "screen", gen, { screen: scr });
    await trackEvent(
      "run_finished",
      { ready: false, outcome: "blocked", reason: "not_a_job" },
      userId,
    );
    return;
  }

  if (scr.regulation === "block") {
    gen = { ...gen, status: "done", step: "blocked" };
    await setGen(runId, "blocked", "blocked", gen, {
      screen: scr,
      adjacent_roles: scr.adjacent_roles,
    });
    await trackEvent(
      "run_finished",
      {
        ready: false,
        outcome: "blocked",
        role_title: scr.role_title,
        regulation: scr.regulation,
      },
      userId,
    );
    return;
  }

  // Non-blocking wait activity for customers
  let roleMinute: string | null = null;
  try {
    roleMinute = await completeText({
      job: "screen",
      purpose: "role_minute",
      promptVersion: ROLE_MINUTE_PROMPT_VERSION,
      runId,
      maxTokens: 400,
      messages: [{ role: "user", content: roleMinutePrompt(scr) }],
    });
  } catch {
    roleMinute = null;
  }

  const regulationBanner =
    scr.regulation === "flag"
      ? scr.reason ||
        "This role sits in a regulated area. Tasks stay on the workplace side — no licensed professional decisions."
      : null;

  let issues: string[] = [];
  let lastBundle: ScenarioBundle | null = null;
  let lastStructural = false;
  let garbled = 0;
  let lastModel = "";
  // Silent recovery: fresh → repair → one more fresh (plus one JSON garbled retry)
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts + garbled; attempt++) {
    // Ladder: fresh → repair (once) → fresh again
    const useRepair =
      attempt === 2 &&
      Boolean(lastBundle) &&
      !lastStructural &&
      issues.length > 0;

    gen = {
      ...gen,
      attempt,
      mode: useRepair ? "repair" : "fresh",
      step: useRepair ? "repair" : "plan",
      checks: [],
      audit: null,
      err: null,
      customerStage: customerStageFor(
        useRepair ? "repair" : "plan",
        attempt,
      ),
    };
    await setGen(
      runId,
      useRepair ? "repairing" : "planning",
      gen.step,
      gen,
      {
        screen: scr,
        regulation_banner: regulationBanner,
        role_minute: roleMinute,
      },
    );

    let bundle: ScenarioBundle | null = null;
    try {
      if (useRepair && lastBundle && issues.length) {
        const { data, model } = await completeJson({
          job: "repair",
          purpose: "repair",
          promptVersion: REPAIR_PROMPT_VERSION,
          runId,
          maxTokens: 16000,
          messages: [
            {
              role: "user",
              content: repairPrompt(lastBundle, level, issues),
            },
          ],
          schema: looseBundle,
        });
        lastModel = model;
        bundle = normalize(coerceBundle(data), level);
      } else {
        const planned = await planTwoPass({
          runId,
          scr,
          input,
          level,
          gen,
          regulationBanner,
          issues: issues.length ? issues : null,
        });
        gen = planned.gen;
        lastModel = planned.model;
        if (planned.pass1Failed?.length) {
          lastBundle = planned.bundle;
          lastStructural = true;
          issues = planned.pass1Failed;
          if (attempt >= maxAttempts + garbled) {
            await failOrShelf({
              runId,
              userId,
              level,
              scr,
              gen,
              regulationBanner,
              roleMinute,
              err: "Checks still failing after recovery.",
              structural: true,
              step: "plan",
            });
            return;
          }
          continue;
        }
        bundle = planned.bundle;
      }
    } catch (e) {
      if (e instanceof AiError && e.code === "invalid_json") {
        if (garbled < 1) {
          garbled++;
          issues = [
            ...issues,
            "Your last reply was not valid JSON or was cut off. Reply with only the JSON object, and keep every text field short.",
          ];
          continue;
        }
        await failOrShelf({
          runId,
          userId,
          level,
          scr,
          gen,
          regulationBanner,
          roleMinute,
          err: "The AI's answer came back garbled twice. Try again; shorter job posts help.",
          structural: true,
          step: "plan",
        });
        return;
      }
      await failOrShelf({
        runId,
        userId,
        level,
        scr,
        gen,
        regulationBanner,
        roleMinute,
        err: e instanceof AiError ? e.message : copyFor("refused"),
        structural: true,
        step: "plan",
      });
      return;
    }

    if (!bundle) {
      issues = [
        ...issues,
        "The reply was not one JSON object with track, day and ledger.",
      ];
      continue;
    }

    gen = {
      ...gen,
      step: "check",
      customerStage: customerStageFor("check", attempt),
    };
    await setGen(runId, "checking", "check", gen, {
      screen: scr,
      regulation_banner: regulationBanner,
      role_minute: roleMinute,
    });

    const checks = codeChecks(bundle, level, scr);
    const structural = hasStructuralFail(checks);
    let audit: z.infer<typeof auditResultSchema> | null = null;

    if (!structural) {
      try {
        const { data } = await completeJson({
          job: "audit",
          purpose: "audit",
          promptVersion: AUDIT_PROMPT_VERSION,
          runId,
          messages: [
            { role: "user", content: auditPrompt(bundle, level) },
          ],
          schema: auditResultSchema,
        });
        audit = data;
      } catch {
        audit = { ok: true, issues: [] };
      }
    }

    const majorIssues = (audit?.issues || [])
      .filter((i) => i.severity === "major")
      .map((i) => i.text);
    const codeFails = failingReasons(checks);
    const allIssues = [...codeFails, ...majorIssues];
    const passed =
      !structural &&
      codeFails.length === 0 &&
      audit?.ok !== false &&
      majorIssues.length === 0;

    gen = {
      ...gen,
      checks,
      audit: audit
        ? { ok: audit.ok, issues: audit.issues }
        : null,
      stage: { ...gen.stage, check: passed ? "ok" : "bad" },
    };

    await insertPlan({
      runId,
      attempt,
      mode: useRepair ? "repair" : "fresh",
      bundle,
      checks,
      audit,
      passed,
      promptVersion: useRepair
        ? REPAIR_PROMPT_VERSION
        : PLAN_PROMPT_VERSION,
      model: lastModel,
    });

    await trackEvent(
      "plan_checked",
      {
        attempt,
        mode: useRepair ? "repair" : "fresh",
        passed,
        failing: codeFails.slice(0, 8),
        role_title: scr.role_title,
        level,
      },
      userId,
    );

    if (passed) {
      gen = {
        ...gen,
        status: "done",
        step: "ready",
        customerStage: "Ready",
      };
      await setGen(runId, "ready", "ready", gen, {
        screen: scr,
        regulation_banner: regulationBanner,
        role_minute: roleMinute,
        summary: publicReadySummary(bundle),
      });
      await trackEvent(
        "run_finished",
        {
          ready: true,
          outcome: "ready",
          role_title: scr.role_title,
          level,
          attempt,
        },
        userId,
      );
      return;
    }

    lastBundle = bundle;
    lastStructural = structural;
    issues = allIssues.length
      ? allIssues
      : ["Quality checks failed; fix format, numbers, brands or wiring."];

    // Structural break → skip repair, go straight to fresh on next loop
    if (structural) {
      lastBundle = null;
    }

    if (attempt >= maxAttempts + garbled) {
      await failOrShelf({
        runId,
        userId,
        level,
        scr,
        gen,
        regulationBanner,
        roleMinute,
        err: "Checks still failing after recovery.",
        structural,
        step: "check",
      });
      return;
    }
  }
}

export type { CheckResult };
