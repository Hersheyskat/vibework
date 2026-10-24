/**
 * Shelf smoke: seed → match Product Manager → personalise → attach to a fake run.
 * Usage: npx tsx --env-file=.env.local scripts/smoke-shelf.ts
 */
import { createRun, getRun } from "../lib/db/runs";
import { matchShelfDay } from "../lib/shelf/match";
import { tryOfferShelf } from "../lib/shelf/offer";
import { seedShelfIfEmpty } from "../lib/shelf/seed";
import type { GenProgress } from "../lib/db/runs";

async function main() {
  console.log("=== Shelf smoke ===");
  const seeded = await seedShelfIfEmpty();
  console.log(
    seeded.seeded
      ? `Seeded ${seeded.count} rows`
      : `Already had ${seeded.count} rows`,
  );

  const userId = "00000000-0000-4000-8000-000000000088";
  const match = await matchShelfDay({
    roleTitle: "Associate Product Manager",
    level: "medium",
    userId,
  });
  if (!match) throw new Error("Expected shelf match for Product Manager");
  console.log(
    `PASS match · ${match.roleKey} v${match.readyDay.variant} · ${match.label}`,
  );

  const runId = await createRun({
    userId,
    inputText: "Associate Product Manager at a grocery delivery startup",
    level: "medium",
    payload: {},
  });

  const gen: GenProgress = {
    status: "failed",
    step: "check",
    attempt: 3,
    checks: [],
    audit: null,
    err: "Checks still failing after recovery.",
    stage: {},
    customerStage: "Taking longer than usual",
  };

  const offer = await tryOfferShelf({
    runId,
    userId,
    level: "medium",
    scr: {
      is_job: true,
      role_title: "Associate Product Manager",
      industry: "Consumer tech",
      location_hint: "Bengaluru",
      regulation: "none",
      reason: "",
      employer_names: [],
      adjacent_roles: [],
    },
    gen,
    regulationBanner: null,
    roleMinute: "You shape the product.",
  });

  if (!offer) throw new Error("Expected shelf offer");
  const run = await getRun(runId);
  if (run?.status !== "ready") throw new Error(`Expected ready, got ${run?.status}`);
  if (!run.screenJson?.shelf_offer) throw new Error("Missing shelf_offer on payload");
  console.log(`PASS offer · status=ready · ${offer.message}`);
  console.log("=== Shelf smoke done ===");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
