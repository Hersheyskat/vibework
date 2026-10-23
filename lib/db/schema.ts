import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";

/** Generation run: one per "Build my work-day". */
export const runs = pgTable(
  "runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    inputText: text("input_text").notNull(),
    level: text("level").notNull(), // beginner | medium | advanced
    status: text("status").notNull().default("guarding"),
    currentStep: text("current_step"),
    screenJson: jsonb("screen_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("runs_user_id_idx").on(t.userId)],
);

/** Every plan attempt (fresh or repair); bundle_json is server-only. */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull().default(1),
    mode: text("mode").notNull(), // fresh | repair
    bundleJson: jsonb("bundle_json").notNull(),
    checksJson: jsonb("checks_json"),
    auditJson: jsonb("audit_json"),
    passed: boolean("passed").notNull().default(false),
    promptVersion: text("prompt_version"),
    model: text("model"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("plans_run_id_idx").on(t.runId)],
);

/** One play session on a passing plan. */
export const games = pgTable(
  "games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),
    stateJson: jsonb("state_json").notNull().default({}),
    status: text("status").notNull().default("playing"), // playing | scored
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [
    index("games_user_id_idx").on(t.userId),
    index("games_run_id_idx").on(t.runId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    thread: text("thread").notNull(), // character id | assist | mentor
    sender: text("sender").notNull(), // player | character | system
    text: text("text").notNull(),
    imagePaths: jsonb("image_paths").$type<string[]>().default([]),
    returnedData: boolean("returned_data"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("messages_game_id_idx").on(t.gameId)],
);

export const scores = pgTable("scores", {
  gameId: uuid("game_id")
    .primaryKey()
    .references(() => games.id, { onDelete: "cascade" }),
  feedbackJson: jsonb("feedback_json").notNull(),
  total: integer("total").notNull(),
  model: text("model"),
  promptVersion: text("prompt_version"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const llmCalls = pgTable(
  "llm_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id").references(() => runs.id, { onDelete: "set null" }),
    gameId: uuid("game_id").references(() => games.id, {
      onDelete: "set null",
    }),
    purpose: text("purpose").notNull(),
    provider: text("provider"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    cacheReadTokens: integer("cache_read_tokens"),
    latencyMs: integer("latency_ms"),
    costUsd: doublePrecision("cost_usd"),
    errorCode: text("error_code"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("llm_calls_run_id_idx").on(t.runId),
    index("llm_calls_game_id_idx").on(t.gameId),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id"),
    name: text("name").notNull(),
    propsJson: jsonb("props_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("events_name_idx").on(t.name)],
);

/** Shelf of ready-made days (NEW · Customers never see errors). */
export const readyDays = pgTable(
  "ready_days",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roleKey: text("role_key").notNull(),
    level: text("level").notNull(),
    planId: uuid("plan_id").references(() => plans.id, {
      onDelete: "set null",
    }),
    variant: integer("variant").notNull().default(1),
    servedCount: integer("served_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("ready_days_role_level_idx").on(t.roleKey, t.level)],
);
