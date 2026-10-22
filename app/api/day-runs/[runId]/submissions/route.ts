import { NextResponse } from "next/server";
import { toPublicPayload } from "@/lib/engine/public";
import { getDayRun } from "@/lib/engine/store";
import { handleSubmission } from "@/lib/engine/turn";

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await context.params;
    const run = getDayRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }
    const body = (await request.json()) as { taskId?: string; text?: string };
    if (!body.taskId || !body.text?.trim()) {
      return NextResponse.json(
        { error: "taskId and text are required" },
        { status: 400 },
      );
    }
    const updated = await handleSubmission({
      run,
      taskId: body.taskId,
      text: body.text,
    });
    return NextResponse.json(toPublicPayload(updated));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Submission failed" },
      { status: 400 },
    );
  }
}
