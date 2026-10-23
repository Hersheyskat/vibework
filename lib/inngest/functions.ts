import { generateDay } from "@/lib/jobs/generate-day";
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

export const inngestFunctions = [generateDayFn];
