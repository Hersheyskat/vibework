import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { codeChecks } from "@/lib/scenario/checks";
import { normalize } from "@/lib/scenario/normalize";
import type { ScenarioBundle } from "@/lib/scenario/schema";
import {
  countReadyDays,
  ensureShelfSystemRun,
  insertReadyDay,
  insertShelfPlan,
} from "./db";

const SEED_PROMPT_VERSION = "shelf-seed-zippy-v1";

/** Only seed role_keys whose bundle matches the practice job (honest shelf). */
const SEED_ROLE_KEYS = ["product-manager"] as const;

function loadZippy(): ScenarioBundle {
  const raw = JSON.parse(
    readFileSync(
      resolve("scenarios/example/example-bundle-zippy-medium.json"),
      "utf8",
    ),
  );
  const b = normalize(raw, "medium");
  if (!b) throw new Error("Zippy example failed to normalize");
  const fails = codeChecks(b, "medium", null).filter((c) => c.status === "fail");
  if (fails.length) throw new Error("Zippy example fails checks");
  return b;
}

/**
 * Seed Zippy medium as 3 variants for product-manager (MVP bootstrap).
 * Nightly batch will add more roles. Idempotent if ready_days non-empty.
 */
export async function seedShelfIfEmpty(): Promise<{
  seeded: boolean;
  count: number;
}> {
  const existing = await countReadyDays();
  if (existing > 0) return { seeded: false, count: existing };

  const bundle = loadZippy();
  const runId = await ensureShelfSystemRun();
  let n = 0;

  for (const roleKey of SEED_ROLE_KEYS) {
    for (let variant = 1; variant <= 3; variant++) {
      const planId = await insertShelfPlan({
        runId,
        bundle,
        promptVersion: SEED_PROMPT_VERSION,
      });
      await insertReadyDay({
        roleKey,
        level: "medium",
        planId,
        variant,
      });
      n++;
    }
  }

  return { seeded: true, count: n };
}
