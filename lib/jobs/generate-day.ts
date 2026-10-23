import { z } from "zod";
import { completeJson } from "@/lib/ai/client";
import { AiError, copyFor } from "@/lib/ai/errors";
import { auditPrompt, AUDIT_PROMPT_VERSION } from "@/lib/ai/prompts/audit";
import { planPrompt, PLAN_PROMPT_VERSION } from "@/lib/ai/prompts/plan";
import { repairPrompt, REPAIR_PROMPT_VERSION } from "@/lib/ai/prompts/repair";
import { screenPrompt, SCREEN_PROMPT_VERSION } from "@/lib/ai/prompts/screen";
import {
  codeChecks,
  failingReasons,
  hasStructuralFail,
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
import { BLOCK_KW, type LevelId } from "@/lib/try/levels";

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

export async function generateDay(runId: string): Promise<void> {
  const run = await getRun(runId);
  if (!run) throw new Error(`run ${runId} not found`);

  const level = run.level as LevelId;
  const input = run.inputText;
  let gen: GenProgress = {
    status: "running",
    step: "screen",
    attempt: 0,
    checks: [],
    audit: null,
    err: null,
    stage: {},
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
    };
    await setGen(runId, "failed", "screen", gen);
    return;
  }

  if (BLOCK_KW.test(scr.role_title || "") && scr.regulation === "none") {
    scr = { ...scr, regulation: "flag" };
  }

  gen = { ...gen, stage: { ...gen.stage, screen: "ok" } };
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
    };
    await setGen(runId, "failed", "screen", gen, { screen: scr });
    return;
  }

  if (scr.regulation === "block") {
    gen = { ...gen, status: "done", step: "blocked" };
    await setGen(runId, "blocked", "blocked", gen, {
      screen: scr,
      adjacent_roles: scr.adjacent_roles,
    });
    return;
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

  for (let attempt = 1; attempt <= 2 + garbled; attempt++) {
    const mode: "fresh" | "repair" =
      attempt > 1 && lastBundle && !lastStructural ? "repair" : "fresh";

    gen = {
      ...gen,
      attempt,
      mode,
      step: mode === "repair" ? "repair" : "plan",
      checks: [],
      audit: null,
      err: null,
    };
    await setGen(
      runId,
      mode === "repair" ? "repairing" : "planning",
      gen.step,
      gen,
      { screen: scr, regulation_banner: regulationBanner },
    );

    let bundle: ScenarioBundle | null = null;
    try {
      if (mode === "repair" && lastBundle && issues.length) {
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
        // Single-shot plan (prototype path) — faster and less truncation than 2-pass+fallback
        const full = await completeJson({
          job: "plan",
          purpose: "plan",
          promptVersion: PLAN_PROMPT_VERSION,
          runId,
          maxTokens: 16000,
          messages: [
            {
              role: "user",
              content: planPrompt(
                scr,
                input,
                level,
                issues.length ? issues : null,
              ),
            },
          ],
          schema: looseBundle,
        });
        lastModel = full.model;
        bundle = normalize(coerceBundle(full.data), level);
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
        gen = {
          ...gen,
          status: "failed",
          err: "The AI's answer came back garbled twice. Try again; shorter job posts help.",
          structural: true,
        };
        await setGen(runId, "failed", "plan", gen, { screen: scr });
        return;
      }
      gen = {
        ...gen,
        status: "failed",
        err: e instanceof AiError ? e.message : copyFor("refused"),
        structural: true,
      };
      await setGen(runId, "failed", "plan", gen, { screen: scr });
      return;
    }

    if (!bundle) {
      issues = [
        ...issues,
        "The reply was not one JSON object with track, day and ledger.",
      ];
      continue;
    }

    gen = { ...gen, step: "check" };
    await setGen(runId, "checking", "check", gen, {
      screen: scr,
      regulation_banner: regulationBanner,
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
      (audit?.ok !== false) &&
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
      mode,
      bundle,
      checks,
      audit,
      passed,
      promptVersion: PLAN_PROMPT_VERSION,
      model: lastModel,
    });

    if (passed) {
      gen = { ...gen, status: "done", step: "ready" };
      await setGen(runId, "ready", "ready", gen, {
        screen: scr,
        regulation_banner: regulationBanner,
        summary: publicReadySummary(bundle),
      });
      return;
    }

    lastBundle = bundle;
    lastStructural = structural;
    issues = allIssues.length
      ? allIssues
      : ["Quality checks failed; fix format, numbers, brands or wiring."];

    if (attempt >= 2 + garbled) {
      gen = {
        ...gen,
        status: "failed",
        err: "Checks still failing after one repair.",
        structural,
      };
      await setGen(runId, "failed", "check", gen, {
        screen: scr,
        regulation_banner: regulationBanner,
      });
      return;
    }
  }
}

export type { CheckResult };
