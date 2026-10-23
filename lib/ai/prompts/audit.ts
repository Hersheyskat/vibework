import type { ScenarioBundle } from "@/lib/scenario/schema";
import type { LevelId } from "@/lib/try/levels";

export const AUDIT_PROMPT_VERSION = "audit-v1";

export function auditPrompt(b: ScenarioBundle, level: LevelId): string {
  return `You are a strict QA reviewer for VibeWork, a job simulation. Below is a generated work-day plan (JSON) for the role "${b.track.role}" at ${level} level. Review it.

Check:
1. Numbers agree between the dashboard, emails, hidden facts, expected answers and the ledger.
2. Any real company, brand, product, institution or real person name used as the employer, a competitor, a customer or a character, or a fictional name confusingly close to a real brand. Real work platforms and tools used as tools (ad platforms, spreadsheets, CRM) are fine. Real books in learning_library are fine.
3. The twist can be handled well only with the hidden facts, and the expected answers follow from those facts.
4. It fits the ${level} level.
5. The day is realistic for this role.
6. No task asks the learner to make a licensed professional decision (medical, legal, aviation).

Reply with only JSON: {"ok":true,"issues":[{"severity":"major or minor","text":"one specific sentence"}]}
"major" ONLY for: the expected answer is wrong or contradicts the facts; numbers contradict each other; the twist or an expected answer cannot be reached from the hidden facts at all; a real brand as employer, competitor or character; a licensed professional decision. Everything else is "minor": clarity, nuance, extra angles, timing details, polish. Report at most 6 issues. "ok" is false if any issue is major.

PLAN:
${JSON.stringify({ track: b.track, day: b.day, ledger: b.ledger, claims: b.claims || [] })}`;
}
