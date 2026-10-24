import type { ScreenResult } from "@/lib/scenario/schema";

export const ROLE_MINUTE_PROMPT_VERSION = "role-minute-v1";

/** Haiku: 60-second “your role in a minute” while the day builds (customer wait activity). */
export function roleMinutePrompt(scr: ScreenResult): string {
  return `Write a 60-second spoken briefing for someone about to practise this job in a simulation. Plain English, India-friendly workplace tone. 90–140 words. No markdown. No company brand names. Cover: what a good day looks like, who they usually work with, and one habit that separates strong from average performers.

Role: ${scr.role_title}
Industry: ${scr.industry}
Location hint: ${scr.location_hint || "India"}
${scr.regulation === "flag" ? "Note: stay on workplace skills only; no licensed professional decisions.\n" : ""}
Reply with ONLY the briefing text.`;
}
