export type LevelId = "beginner" | "medium" | "advanced";

export const LEVELS: Record<
  LevelId,
  { label: string; blurb: string; pulls: number; colleagues: number }
> = {
  beginner: {
    label: "Beginner",
    blurb: "Clean data, helpful colleagues, a hint on every task.",
    pulls: 25,
    colleagues: 3,
  },
  medium: {
    label: "Medium",
    blurb: "Realistic data, one pushy stakeholder, no hints.",
    pulls: 18,
    colleagues: 4,
  },
  advanced: {
    label: "Advanced",
    blurb: "Messy data, tough stakeholders, conflicting asks.",
    pulls: 12,
    colleagues: 5,
  },
};

export const LEVEL_RULES: Record<LevelId, string> = {
  beginner:
    "Boss plus exactly 3 colleagues. Clean, round numbers; dashboard of 5–7 rows. Colleagues are cooperative and answer slightly vague questions generously. The twist is a simple, clearly risky request that a careful beginner can turn down with one fact. Every task has a 'hint' field: one friendly sentence on how to approach it, never the answer.",
  medium:
    "Boss plus exactly 4 colleagues. Realistic numbers; dashboard of 7–9 rows. The info source needs precise questions. The twist sender pushes back once before accepting a measured alternative. No 'hint' fields.",
  advanced:
    "Boss plus exactly 5 colleagues. Messy, realistic data; dashboard of 9–12 rows, including one average that hides a split and one figure with a data-quality problem (the info source can reveal the problem as a hidden fact). Two colleagues have conflicting agendas, the boss is demanding and short on time, the brief is slightly ambiguous, and the twist has a tight deadline and pushes back twice. No 'hint' fields.",
};

export const EXAMPLE_ROLES = [
  "Customer Support Executive at a food delivery app",
  "Social Media Marketing Executive",
  "Retail Store Manager",
  "Recruiter (tech hiring)",
  "Supply Chain Analyst",
  "Event Planner for weddings",
] as const;

export const JOB_INPUT_MAX = 6000;

export const PALETTE = [
  "#3b2fb8",
  "#1f8a55",
  "#d0661f",
  "#b0306b",
  "#2a6fa8",
  "#6b5b16",
  "#0f766e",
  "#7c3aed",
] as const;

export const BLOCK_KW =
  /\b(doctor|physician|surgeon|nurse|nursing|midwife|pharmacist|dentist|an(?:a)?esthe\w*|paramedic|radiologist|psychiatrist|psychologist|physiotherapist|medical officer|lawyer|advocate|attorney|solicitor|barrister|legal counsel|judge|pilot|co-?pilot|first officer|air traffic|aircraft maintenance|police|armed guard|security guard)\b/i;
