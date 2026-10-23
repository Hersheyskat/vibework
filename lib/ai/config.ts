/**
 * Per-job model routing via OpenRouter only.
 * Override any job with AI_MODEL_<JOB> (OpenRouter slug).
 */
export type AiJob =
  | "screen"
  | "plan"
  | "repair"
  | "audit"
  | "colleague"
  | "info_source"
  | "boss"
  | "saathi"
  | "mentor"
  | "score"
  | "debrief"
  | "shelf_match";

export type ProviderId = "openrouter";

export type JobRoute = {
  provider: ProviderId;
  model: string;
};

/** Defaults use Claude through OpenRouter (no direct Anthropic key). */
const defaults: Record<AiJob, JobRoute> = {
  screen: { provider: "openrouter", model: "anthropic/claude-haiku-4.5" },
  plan: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  repair: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  audit: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  colleague: { provider: "openrouter", model: "anthropic/claude-haiku-4.5" },
  info_source: {
    provider: "openrouter",
    model: "anthropic/claude-sonnet-4.5",
  },
  boss: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  saathi: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  mentor: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  score: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  debrief: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  shelf_match: {
    provider: "openrouter",
    model: "anthropic/claude-haiku-4.5",
  },
};

function envKey(job: AiJob): string {
  return `AI_MODEL_${job.toUpperCase()}`;
}

export function routeFor(job: AiJob): JobRoute {
  const override = process.env[envKey(job)]?.trim();
  if (override) {
    return { provider: "openrouter", model: override };
  }
  return defaults[job];
}

/** Rough USD per 1M tokens for llm_calls cost estimates (list prices, verify). */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const m = model.toLowerCase();
  let inRate = 2;
  let outRate = 10;
  if (m.includes("haiku") || m.includes("flash") || m.includes("luna")) {
    inRate = 0.1;
    outRate = 0.5;
  } else if (m.includes("opus")) {
    inRate = 4;
    outRate = 20;
  }
  return (inputTokens * inRate + outputTokens * outRate) / 1_000_000;
}
