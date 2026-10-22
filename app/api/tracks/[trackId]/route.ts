import { NextResponse } from "next/server";
import { loadTrack } from "@/lib/scenarios/load";

export async function GET(
  _request: Request,
  context: { params: Promise<{ trackId: string }> },
) {
  try {
    const { trackId } = await context.params;
    const track = loadTrack(trackId);
    return NextResponse.json({
      id: track.id,
      title: track.title,
      role: track.role,
      company: {
        name: track.company.name,
        one_liner: track.company.one_liner,
      },
      days: track.days.map((d) => ({
        day: d.day,
        title: d.title,
      })),
      assistant: {
        id: track.assistant.id,
        name: track.assistant.name,
        role: track.assistant.role,
      },
      cast: track.cast.map((c) => ({
        id: c.id,
        name: c.name,
        role: c.role,
        kind: c.kind,
        color: c.color,
        initials: c.initials,
        first_day: c.first_day,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Not found" },
      { status: 404 },
    );
  }
}
