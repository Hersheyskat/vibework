import { JOB_INPUT_MAX } from "./levels";

/** True when the input is basically only a job-site link (prototype linkOnly). */
export function linkOnly(text: string): boolean {
  const rest = String(text)
    .replace(/https?:\/\/\S+|www\.\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return rest.length < 25 && /https?:\/\/|www\./i.test(text);
}

export type GuardResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "link_only" };

export function guardJobInput(raw: string): GuardResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (linkOnly(trimmed)) return { ok: false, reason: "link_only" };
  const text =
    trimmed.length > JOB_INPUT_MAX
      ? trimmed.slice(0, JOB_INPUT_MAX)
      : trimmed;
  return { ok: true, text };
}
