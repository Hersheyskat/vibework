import { z } from "zod";

const conditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({ submitted: z.string() }),
    z.object({ task_done: z.string() }),
    z.object({
      counter_at_least: z.object({
        counter: z.string(),
        value: z.number(),
      }),
    }),
    z.object({
      messages_sent: z.object({
        to: z.string(),
        at_least: z.number(),
      }),
    }),
    z.object({ trigger_fired: z.string() }),
    z.object({ all: z.array(conditionSchema) }),
    z.object({ any: z.array(conditionSchema) }),
  ]),
);

export const screenResultSchema = z.object({
  is_job: z.boolean(),
  role_title: z.string(),
  industry: z.string().optional().default(""),
  location_hint: z.string().optional().default("India"),
  regulation: z.enum(["none", "flag", "block"]),
  reason: z.string().optional().default(""),
  employer_names: z.array(z.string()).optional().default([]),
  adjacent_roles: z.array(z.string()).optional().default([]),
});

export type ScreenResult = z.infer<typeof screenResultSchema>;

export const auditResultSchema = z.object({
  ok: z.boolean(),
  issues: z
    .array(
      z.object({
        severity: z.enum(["major", "minor"]),
        text: z.string(),
      }),
    )
    .optional()
    .default([]),
});

export type AuditResult = z.infer<typeof auditResultSchema>;

/** Loose bundle schema — AI JSON is normalised then checked by codeChecks. */
export const bundleSchema = z
  .object({
    track: z.record(z.string(), z.unknown()),
    day: z.record(z.string(), z.unknown()),
    ledger: z.array(z.unknown()).optional().default([]),
    claims: z.array(z.unknown()).optional().default([]),
  })
  .passthrough();

export type ScenarioBundle = {
  track: Track;
  day: Day;
  ledger: LedgerEntry[];
  claims: Claim[];
};

export type Track = {
  schema_version?: string;
  id?: string;
  version?: number;
  title?: string;
  role?: string;
  company?: {
    name?: string;
    one_liner?: string;
    world_briefing?: string;
  };
  days?: unknown[];
  skills: { id?: string; name?: string; description?: string }[];
  cast: CastMember[];
  mentor?: { name?: string; title?: string; years?: number };
  style_rules?: string;
  learning_library?: Record<string, unknown>;
};

export type CastMember = {
  id: string;
  name?: string;
  role?: string;
  kind?: string;
  cares_about?: string;
  persona?: string;
  first_day?: number;
  color?: string;
  initials?: string;
};

export type DayCharacter = {
  id: string;
  available: "start" | "locked";
  opener?: string | null;
  today?: string;
  hidden_facts: { id?: string; fact?: string; reveal_if?: string }[];
  limits?: { data_pulls?: number; questions?: number };
  reply_flags?: string[];
};

export type Task = {
  id: string;
  title?: string;
  minutes?: number;
  kind?: string;
  submit_to?: string;
  description?: string;
  hint?: string;
  done_when?: unknown;
};

export type Trigger = {
  id?: string;
  when?: unknown;
  do?: TriggerAction[];
};

export type TriggerAction = {
  message?: { from?: string; text?: string };
  unlock?: string;
  ai_reply?: { from?: string; direction?: string };
  open?: string;
};

export type Day = {
  schema_version?: string;
  track?: string;
  day?: number;
  id?: string;
  version?: number;
  title?: string;
  theme?: string;
  duration_minutes?: number[];
  skills_focus?: string[];
  practised?: string[];
  story_so_far?: string;
  world_today?: string;
  canon_after_day?: string;
  public: {
    inbox: { from?: string; time?: string; subject?: string; body?: string }[];
    dashboard: {
      title?: string;
      subtitle?: string;
      columns: string[];
      rows: { cells?: string[]; miss?: boolean }[];
      notes: string[];
    };
    reviews: unknown[];
    documents: unknown[];
  };
  characters: DayCharacter[];
  group_chats: unknown[];
  tasks: Task[];
  triggers: Trigger[];
  clock: {
    start?: string;
    end?: string;
    steps: { when?: unknown; time?: string }[];
  };
  scoring: {
    strong_player?: string;
    expected_answers: Record<string, string>;
    common_mistakes?: string[];
    senior_view?: string;
    drill?: string;
  };
};

export type LedgerEntry = {
  id?: string;
  label?: string;
  value?: number;
  formula?: string;
};

export type Claim = {
  text?: string;
  left?: string;
  op?: string;
  right?: string;
};

export { conditionSchema };
