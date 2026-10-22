import { NextResponse } from "next/server";
import { toPublicPayload } from "@/lib/engine/public";
import { getDayRun, saveDayRun } from "@/lib/engine/store";

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = getDayRun(runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  run.openHint = null;
  saveDayRun(run);
  return NextResponse.json(toPublicPayload(run));
}
