import { codeChecks } from "@/lib/scenario/checks";
import type { ScenarioBundle, ScreenResult } from "@/lib/scenario/schema";
import type { LevelId } from "@/lib/try/levels";

/**
 * Light personalisation at shelf match (BRIEF): job title and city in public
 * text only. Never touch numbers or hidden facts. Re-run brand check.
 */
export function personaliseShelfBundle(
  bundle: ScenarioBundle,
  scr: ScreenResult,
  level: LevelId,
): { bundle: ScenarioBundle; ok: boolean; brandDetail?: string } {
  const out = structuredClone(bundle) as ScenarioBundle;
  const company = out.track.company?.name || "the company";
  const roleTitle = (scr.role_title || out.track.role || "the role").trim();
  const city = (scr.location_hint || "").trim();

  out.track.title = `${roleTitle} at ${company}`;
  // Keep track.role as the shelf role's practice framing; surface learner title in theme
  const themeBase = out.day.theme || "";
  out.day.theme = city
    ? `${themeBase}${themeBase ? " · " : ""}Based in ${city}.`
    : themeBase;

  if (out.day.public.inbox[0]) {
    const first = out.day.public.inbox[0];
    const body = first.body ?? "";
    const cityLine = city ? `\n(You're based in ${city}.)` : "";
    if (!body.includes("based in") && cityLine) {
      first.body = body.replace(/\n*$/, "") + cityLine;
    }
    const subject = first.subject ?? "";
    if (roleTitle && subject) {
      if (/welcome|first day|first problem/i.test(subject)) {
        first.subject = `Welcome — your first day as ${roleTitle}`;
      }
    }
  }

  const brand = codeChecks(out, level, scr).find(
    (c) => c.name === "No real brands",
  );
  if (brand?.status === "fail") {
    // Revert public text changes; serve unpersonalised shelf day
    return {
      bundle,
      ok: true,
      brandDetail: brand.detail,
    };
  }
  return { bundle: out, ok: true };
}
