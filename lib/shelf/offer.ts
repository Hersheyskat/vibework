import { trackEvent } from "@/lib/analytics/track";
import { insertPlan, updateRun, type GenProgress } from "@/lib/db/runs";
import { publicReadySummary } from "@/lib/scenario/public-summary";
import type { ScreenResult } from "@/lib/scenario/schema";
import type { LevelId } from "@/lib/try/levels";
import { bumpServed, getPlanBundleById } from "./db";
import { matchShelfDay } from "./match";
import { personaliseShelfBundle } from "./personalise";
import { seedShelfIfEmpty } from "./seed";

export type ShelfOffer = {
  roleKey: string;
  label: string;
  message: string;
  readyDayId: string;
  variant: number;
  fromShelf: true;
};

/**
 * After generation recovery fails: attach nearest shelf day to this run as ready.
 */
export async function tryOfferShelf(opts: {
  runId: string;
  userId: string;
  level: LevelId;
  scr: ScreenResult;
  gen: GenProgress;
  regulationBanner: string | null;
  roleMinute: string | null;
}): Promise<ShelfOffer | null> {
  await seedShelfIfEmpty();

  const match = await matchShelfDay({
    roleTitle: opts.scr.role_title || "",
    level: opts.level,
    userId: opts.userId,
    runId: opts.runId,
  });
  if (!match?.readyDay.planId) return null;

  const base = await getPlanBundleById(match.readyDay.planId);
  if (!base) return null;

  const { bundle } = personaliseShelfBundle(base, opts.scr, opts.level);

  await insertPlan({
    runId: opts.runId,
    attempt: Math.max(opts.gen.attempt || 1, 1) + 100,
    mode: "fresh",
    bundle,
    checks: [],
    audit: { ok: true, issues: [], shelf: true },
    passed: true,
    promptVersion: "shelf-offer-v1",
    model: "shelf",
  });

  await bumpServed(match.readyDay.id, opts.userId);

  const offer: ShelfOffer = {
    roleKey: match.roleKey,
    label: match.label,
    message: `Your exact role needs a little longer; here's a ${match.label} day, ready now.`,
    readyDayId: match.readyDay.id,
    variant: match.readyDay.variant,
    fromShelf: true,
  };

  const gen: GenProgress = {
    ...opts.gen,
    status: "done",
    step: "ready",
    customerStage: "Ready",
    err: null,
  };

  await updateRun(opts.runId, {
    status: "ready",
    currentStep: "ready",
    payload: {
      screen: opts.scr,
      regulation_banner: opts.regulationBanner,
      role_minute: opts.roleMinute,
      summary: publicReadySummary(bundle),
      shelf_offer: offer,
      gen,
    },
  });

  await trackEvent(
    "run_finished",
    {
      ready: true,
      outcome: "shelf",
      roleKey: offer.roleKey,
      level: opts.level,
    },
    opts.userId,
  );

  return offer;
}
