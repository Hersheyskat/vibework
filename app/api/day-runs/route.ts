import { NextResponse } from "next/server";
import { toPublicPayload } from "@/lib/engine/public";
import { createDayRun } from "@/lib/engine/store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      trackId?: string;
      day?: number;
      learnerName?: string;
    };
    const trackId = body.trackId || "zippy-pm";
    const day = body.day ?? 1;
    const learnerName = body.learnerName?.trim() || "Learner";
    const run = createDayRun({ trackId, day, learnerName });
    return NextResponse.json(toPublicPayload(run));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to start day" },
      { status: 400 },
    );
  }
}
