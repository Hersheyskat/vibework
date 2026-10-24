import { getDb, hasDbAccess } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { events } from "@/lib/db/schema";
import { capturePosthog } from "@/lib/observability/posthog";

export type AnalyticsEvent =
  | "job_submitted"
  | "plan_checked"
  | "run_finished"
  | "day_started"
  | "task_submitted"
  | "twist_handled"
  | "day_scored"
  | "debrief_opened"
  | "day_abandoned"
  | "shelf_served"
  | "budget_paused"
  | "admin_runs_opened";

function usePg() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/** Persist a product event; never throws into the request path. */
export async function trackEvent(
  name: AnalyticsEvent | string,
  props: Record<string, unknown> = {},
  userId?: string | null,
): Promise<void> {
  try {
    if (hasDbAccess()) {
      if (usePg()) {
        const db = getDb();
        await db.insert(events).values({
          userId: userId || null,
          name,
          propsJson: props,
        });
      } else {
        const sb = getSupabaseAdmin();
        await sb.from("events").insert({
          user_id: userId || null,
          name,
          props_json: props,
        });
      }
    }
    await capturePosthog(name, props, userId);
  } catch (e) {
    console.error("[vibework] trackEvent failed", name, e);
  }
}
