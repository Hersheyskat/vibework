/**
 * Free-tier caps (BRIEF examples; Hersh can override via env).
 * Defaults: 2 new days / UTC day, 3 / calendar month.
 */
export function limitsConfig() {
  return {
    daysPerDay: numEnv("VIBEWORK_CAP_DAYS_PER_DAY", 2),
    daysPerMonth: numEnv("VIBEWORK_CAP_DAYS_PER_MONTH", 3),
    chatMessagesPerGame: numEnv("VIBEWORK_CAP_CHAT_PER_GAME", 60),
    /** Global spend ceiling in USD for one UTC day; 0 = disabled. */
    dailyBudgetUsd: numEnv("VIBEWORK_DAILY_BUDGET_USD", 50),
    /** Optional webhook / email ping when budget pauses generations. */
    budgetAlertUrl: process.env.VIBEWORK_BUDGET_ALERT_URL?.trim() || "",
  };
}

function numEnv(key: string, fallback: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}
