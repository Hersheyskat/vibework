import { z } from "zod";
import { completeJson } from "@/lib/ai/client";
import {
  labelForRoleKey,
  matchRoleKeyByAlias,
  SHELF_ROLES,
} from "./catalog";
import {
  listAllShelfRoleKeys,
  listReadyDays,
  servedReadyDayIdsForUser,
  type ReadyDayRow,
} from "./db";

const matchSchema = z.object({
  role_key: z.string(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export type ShelfMatch = {
  roleKey: string;
  label: string;
  readyDay: ReadyDayRow;
};

/**
 * Pick closest shelf role + an unserved variant for this user.
 * Code aliases first; Haiku only if needed (BRIEF).
 */
export async function matchShelfDay(opts: {
  roleTitle: string;
  level: string;
  userId: string;
  runId?: string;
}): Promise<ShelfMatch | null> {
  const availableKeys = await listAllShelfRoleKeys();
  if (!availableKeys.length) return null;

  let roleKey = matchRoleKeyByAlias(opts.roleTitle);
  if (roleKey && !availableKeys.includes(roleKey)) roleKey = null;

  if (!roleKey) {
    roleKey = await haikuMatch(opts.roleTitle, availableKeys, opts.runId);
  }
  if (!roleKey || roleKey === "none") return null;

  const days = await listReadyDays(roleKey, opts.level);
  if (!days.length) {
    // Fall back to medium shelf for this role if level empty
    if (opts.level !== "medium") {
      const med = await listReadyDays(roleKey, "medium");
      return pickUnserved(med, opts.userId, roleKey);
    }
    return null;
  }
  return pickUnserved(days, opts.userId, roleKey);
}

async function pickUnserved(
  days: ReadyDayRow[],
  userId: string,
  roleKey: string,
): Promise<ShelfMatch | null> {
  const withPlan = days.filter((d) => d.planId);
  if (!withPlan.length) return null;
  const served = await servedReadyDayIdsForUser(userId);
  const fresh = withPlan.filter((d) => !served.has(d.id));
  const pool = fresh.length ? fresh : withPlan; // if all served, reuse least-served
  pool.sort((a, b) => a.servedCount - b.servedCount || a.variant - b.variant);
  const readyDay = pool[0]!;
  return {
    roleKey,
    label: labelForRoleKey(roleKey),
    readyDay,
  };
}

async function haikuMatch(
  roleTitle: string,
  availableKeys: string[],
  runId?: string,
): Promise<string | null> {
  const catalog = SHELF_ROLES.filter((r) =>
    availableKeys.includes(r.roleKey),
  )
    .map((r) => `${r.roleKey} — ${r.label}`)
    .join("\n");
  if (!catalog) return null;

  try {
    const { data } = await completeJson({
      job: "shelf_match",
      purpose: "shelf_match",
      promptVersion: "shelf-match-v1",
      runId,
      messages: [
        {
          role: "user",
          content: `You match a learner's job title to the closest ready-made practice day on our shelf, or "none".

Learner role title: ${roleTitle}

Shelf roles (role_key — label):
${catalog}

Reply JSON only: {"role_key":"<one of the keys above or none>","confidence":"high|medium|low"}
Pick "none" unless the shelf role is a reasonable practice stand-in (same kind of job family). Do not invent keys.`,
        },
      ],
      schema: matchSchema,
    });
    const key = data.role_key.trim().toLowerCase();
    if (key === "none") return null;
    if (!availableKeys.includes(key)) return null;
    if (data.confidence === "low") return null;
    return key;
  } catch {
    return null;
  }
}
