import type { PublicDayPayload } from "@/lib/scenarios/types";

async function parse<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function startDay(opts: {
  trackId: string;
  day: number;
  learnerName: string;
}) {
  const res = await fetch("/api/day-runs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  return parse<PublicDayPayload>(res);
}

export async function fetchDayRun(runId: string) {
  const res = await fetch(`/api/day-runs/${runId}`);
  return parse<PublicDayPayload>(res);
}

export async function sendMessage(runId: string, thread: string, text: string) {
  const res = await fetch(`/api/day-runs/${runId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread, text }),
  });
  return parse<PublicDayPayload>(res);
}

export async function submitTask(runId: string, taskId: string, text: string) {
  const res = await fetch(`/api/day-runs/${runId}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ taskId, text }),
  });
  return parse<PublicDayPayload>(res);
}

export async function clearOpenHint(runId: string) {
  const res = await fetch(`/api/day-runs/${runId}/clear-open`, {
    method: "POST",
  });
  return parse<PublicDayPayload>(res);
}
