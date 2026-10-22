import { NextResponse } from "next/server";
import { toPublicPayload } from "@/lib/engine/public";
import { getDayRun } from "@/lib/engine/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  const { runId } = await context.params;
  const run = getDayRun(runId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  return NextResponse.json(toPublicPayload(run));
}
