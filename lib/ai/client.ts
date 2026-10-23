import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { llmCalls } from "@/lib/db/schema";
import { estimateCostUsd, routeFor, type AiJob } from "./config";
import { AiError, copyFor } from "./errors";

export type ChatTurn = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type CompleteOpts = {
  job: AiJob;
  purpose: string;
  promptVersion: string;
  messages: ChatTurn[];
  runId?: string;
  gameId?: string;
  temperature?: number;
  jsonMode?: boolean;
  maxRetries?: number;
  /** OpenRouter max_tokens — plan JSON needs headroom. */
  maxTokens?: number;
};

type OpenRouterResponse = {
  choices?: {
    message?: { content?: string | { type?: string; text?: string }[] };
    finish_reason?: string;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: number };
};

function messageContent(
  content: string | { type?: string; text?: string }[] | undefined,
): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p?.text === "string" ? p.text : ""))
      .join("");
  }
  return "";
}

function openRouterConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const baseUrl =
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  return { apiKey, baseUrl };
}

export function openRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

function isTransient(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function logCall(row: {
  runId?: string;
  gameId?: string;
  purpose: string;
  model: string;
  promptVersion: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  costUsd?: number;
  errorCode?: string;
}) {
  try {
    if (process.env.DATABASE_URL?.trim()) {
      const db = getDb();
      await db.insert(llmCalls).values({
        runId: row.runId,
        gameId: row.gameId,
        purpose: row.purpose,
        provider: "openrouter",
        model: row.model,
        promptVersion: row.promptVersion,
        inputTokens: row.inputTokens,
        outputTokens: row.outputTokens,
        latencyMs: row.latencyMs,
        costUsd: row.costUsd,
        errorCode: row.errorCode,
      });
      return;
    }
    if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      const sb = getSupabaseAdmin();
      await sb.from("llm_calls").insert({
        run_id: row.runId ?? null,
        game_id: row.gameId ?? null,
        purpose: row.purpose,
        provider: "openrouter",
        model: row.model,
        prompt_version: row.promptVersion,
        input_tokens: row.inputTokens ?? null,
        output_tokens: row.outputTokens ?? null,
        latency_ms: row.latencyMs,
        cost_usd: row.costUsd ?? null,
        error_code: row.errorCode ?? null,
      });
    }
  } catch {
    // Don't fail the user path if logging fails.
  }
}

async function callOpenRouter(
  opts: CompleteOpts,
): Promise<{ text: string; model: string }> {
  const { apiKey, baseUrl } = openRouterConfig();
  if (!apiKey) throw new AiError("missing_key");

  const route = routeFor(opts.job);
  const maxRetries = opts.maxRetries ?? 2;
  let lastStatus = 0;
  let lastBody = "";

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer":
            process.env.OPENROUTER_APP_URL || "http://localhost:3000",
          "X-Title": process.env.OPENROUTER_APP_NAME || "VibeWork",
        },
        body: JSON.stringify({
          model: route.model,
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? (opts.jsonMode ? 12000 : 4096),
          messages: opts.messages,
          ...(opts.jsonMode
            ? { response_format: { type: "json_object" } }
            : {}),
        }),
      });

      lastStatus = res.status;
      const raw = await res.text();
      lastBody = raw;
      const latencyMs = Date.now() - started;

      if (!res.ok) {
        await logCall({
          runId: opts.runId,
          gameId: opts.gameId,
          purpose: opts.purpose,
          model: route.model,
          promptVersion: opts.promptVersion,
          latencyMs,
          errorCode: String(res.status),
        });
        if (isTransient(res.status) && attempt < maxRetries) {
          await sleep(500 * (attempt + 1));
          continue;
        }
        if (res.status === 429) throw new AiError("rate_limited");
        if (res.status === 401 || res.status === 403)
          throw new AiError("not_granted");
        throw new AiError(
          "refused",
          `OpenRouter error ${res.status}: ${raw.slice(0, 200)}`,
        );
      }

      let data: OpenRouterResponse;
      try {
        data = JSON.parse(raw) as OpenRouterResponse;
      } catch {
        throw new AiError("invalid_json");
      }

      const finish = data.choices?.[0]?.finish_reason;
      const content = messageContent(
        data.choices?.[0]?.message?.content,
      ).trim();
      const inputTokens = data.usage?.prompt_tokens;
      const outputTokens = data.usage?.completion_tokens;
      const costUsd =
        inputTokens != null && outputTokens != null
          ? estimateCostUsd(route.model, inputTokens, outputTokens)
          : undefined;

      await logCall({
        runId: opts.runId,
        gameId: opts.gameId,
        purpose: opts.purpose,
        model: route.model,
        promptVersion: opts.promptVersion,
        inputTokens,
        outputTokens,
        latencyMs,
        costUsd,
        errorCode: finish === "length" ? "truncated" : undefined,
      });

      if (!content) throw new AiError("invalid_json", "Empty model response");
      if (finish === "length") {
        throw new AiError(
          "invalid_json",
          "The AI reply was cut off (too long). Try again.",
        );
      }
      return { text: content, model: route.model };
    } catch (err) {
      if (err instanceof AiError) throw err;
      if (attempt < maxRetries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      await logCall({
        runId: opts.runId,
        gameId: opts.gameId,
        purpose: opts.purpose,
        model: route.model,
        promptVersion: opts.promptVersion,
        latencyMs: Date.now() - started,
        errorCode: "network",
      });
      throw new AiError(
        "timeout",
        err instanceof Error ? err.message : copyFor("timeout"),
      );
    }
  }

  throw new AiError(
    "refused",
    `OpenRouter error ${lastStatus}: ${lastBody.slice(0, 200)}`,
  );
}

export async function completeText(opts: CompleteOpts): Promise<string> {
  const { text } = await callOpenRouter(opts);
  return text;
}

export function extractJson(text: string): unknown {
  let trimmed = text.trim();
  // Strip markdown fences models sometimes wrap around JSON
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  if (fence) trimmed = fence[1]!.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        throw new AiError("invalid_json");
      }
    }
    throw new AiError("invalid_json");
  }
}

export async function completeJson<T>(
  opts: CompleteOpts & { schema: z.ZodType<T> },
): Promise<{ data: T; model: string; raw: unknown }> {
  const withJson = { ...opts, jsonMode: true as const };
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, model } = await callOpenRouter(
        attempt === 0
          ? withJson
          : {
              ...withJson,
              messages: [
                ...opts.messages,
                {
                  role: "user",
                  content:
                    "Your last reply was not valid JSON. Reply with only the JSON object, no markdown.",
                },
              ],
            },
      );
      const raw = extractJson(text);
      const parsed = opts.schema.safeParse(raw);
      if (!parsed.success) {
        lastErr = parsed.error;
        continue;
      }
      return { data: parsed.data, model, raw };
    } catch (err) {
      lastErr = err;
      if (err instanceof AiError && err.code !== "invalid_json") throw err;
    }
  }
  throw lastErr instanceof AiError
    ? lastErr
    : new AiError("invalid_json");
}

/** Sum cost for a run from llm_calls (best effort). */
export async function sumRunCostUsd(runId: string): Promise<number> {
  try {
    const db = getDb();
    const rows = await db
      .select({ costUsd: llmCalls.costUsd })
      .from(llmCalls)
      .where(eq(llmCalls.runId, runId));
    return rows.reduce((a, r) => a + (r.costUsd ?? 0), 0);
  } catch {
    return 0;
  }
}
