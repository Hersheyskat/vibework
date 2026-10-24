import { generateDay } from "@/lib/jobs/generate-day";
import { restockShelf } from "@/lib/shelf/restock";
import { inngest } from "./client";

export const generateDayFn = inngest.createFunction(
  {
    id: "generate-day",
    retries: 1,
    triggers: [{ event: "try/generate.requested" }],
  },
  async ({ event, step }) => {
    const runId = String(
      (event.data as { runId?: string }).runId ?? "",
    );
    if (!runId) throw new Error("missing runId");
    await step.run("generate", async () => {
      await generateDay(runId);
    });
    return { runId, ok: true };
  },
);

export const restockShelfFn = inngest.createFunction(
  {
    id: "shelf-restock-nightly",
    retries: 1,
    triggers: [{ cron: "0 2 * * *" }],
  },
  async ({ step }) => {
    const result = await step.run("restock", async () => restockShelf());
    return result;
  },
);

export const inngestFunctions = [generateDayFn, restockShelfFn];
