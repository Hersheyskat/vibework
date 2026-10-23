import { bossId, castOf } from "./normalize";
import type { ScenarioBundle } from "./schema";

/** Public fields safe to send to the browser when a run is ready (M1 summary). */
export function publicReadySummary(bundle: ScenarioBundle) {
  const boss = bossId(bundle);
  const bossCast = castOf(bundle, boss);
  const team = bundle.day.characters.map((c) => {
    const cast = castOf(bundle, c.id);
    return {
      id: c.id,
      name: cast?.name || c.id,
      role: cast?.role || "",
      cares_about: cast?.cares_about || "",
      color: cast?.color || "#555",
      initials: cast?.initials || c.id[0]?.toUpperCase() || "?",
      available: c.available,
    };
  });

  return {
    company: {
      name: bundle.track.company?.name || "",
      one_liner: bundle.track.company?.one_liner || "",
    },
    role: bundle.track.role || "",
    title: bundle.track.title || "",
    theme: bundle.day.theme || "",
    practised: bundle.day.practised || [],
    boss: bossCast
      ? {
          id: boss,
          name: bossCast.name,
          role: bossCast.role,
          color: bossCast.color,
          initials: bossCast.initials,
        }
      : null,
    team,
  };
}
