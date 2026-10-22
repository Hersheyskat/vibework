import { NextResponse } from "next/server";
import { getCatalogTracks } from "@/lib/scenarios/catalog";

export async function GET() {
  return NextResponse.json({ tracks: getCatalogTracks() });
}
