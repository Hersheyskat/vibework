import type { ScenarioBundle } from "@/lib/scenario/schema";
import type { LevelId } from "@/lib/try/levels";

export const REPAIR_PROMPT_VERSION = "repair-v1";

export function repairPrompt(
  b: ScenarioBundle,
  level: LevelId,
  issues: string[],
): string {
  return `You are fixing a VibeWork work-day plan (role: ${b.track.role}, level: ${level}) that failed quality checks. Fix EVERY issue below.

How to fix:
- Change only what is needed. Keep the structure, ids, cast, tasks and triggers.
- If a conclusion doesn't follow from the numbers, either change the numbers so it does, or change the conclusion AND every text that relies on it: hidden facts, the twist message, expected answers, strong_player, common_mistakes, senior_view, world_briefing.
- Keep the ledger and claims in sync with every number and comparison. Every claim must be true.
- No real company, brand or person names.

ISSUES:
- ${issues.join("\n- ")}

Reply with only the full corrected JSON object with keys track, day, ledger and claims.

PLAN:
${JSON.stringify({ track: b.track, day: b.day, ledger: b.ledger, claims: b.claims || [] })}`;
}
