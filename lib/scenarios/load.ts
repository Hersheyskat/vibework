import { readFileSync, readdirSync, existsSync } from "fs";
import path from "path";
import type { DayScenario, TrackScenario } from "./types";

const SCENARIOS_ROOT = path.join(process.cwd(), "scenarios");

export function listTracks(): string[] {
  if (!existsSync(SCENARIOS_ROOT)) return [];
  return readdirSync(SCENARIOS_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

export function loadTrack(trackId: string): TrackScenario {
  const file = path.join(SCENARIOS_ROOT, trackId, "track.json");
  if (!existsSync(file)) {
    throw new Error(`Track not found: ${trackId}`);
  }
  return JSON.parse(readFileSync(file, "utf8")) as TrackScenario;
}

export function loadDay(trackId: string, day: number): DayScenario {
  const track = loadTrack(trackId);
  const entry = track.days.find((d) => d.day === day);
  if (!entry) {
    throw new Error(`Day ${day} not found on track ${trackId}`);
  }
  const file = path.join(SCENARIOS_ROOT, trackId, entry.file);
  if (!existsSync(file)) {
    throw new Error(`Day file missing: ${entry.file}`);
  }
  return JSON.parse(readFileSync(file, "utf8")) as DayScenario;
}

export function getCastMap(track: TrackScenario) {
  return Object.fromEntries(track.cast.map((c) => [c.id, c]));
}
