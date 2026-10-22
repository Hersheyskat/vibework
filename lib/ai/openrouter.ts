export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

function config() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o";
  const baseUrl =
    process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
  return { apiKey, model, baseUrl };
}

export function openRouterConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export async function chatCompletion(opts: {
  messages: ChatTurn[];
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const { apiKey, model, baseUrl } = config();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

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
      model,
      temperature: opts.temperature ?? 0.6,
      messages: opts.messages,
      ...(opts.jsonMode
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty model response");
  return content.trim();
}

/** Offline / missing-key fallback so the UI stays playable. */
export function mockCharacterReply(opts: {
  name: string;
  learnerText: string;
  isLakshmi?: boolean;
}): { text: string; returned_data?: boolean } {
  if (opts.isLakshmi) {
    const precise =
      /repeat|coupon|delivery|prep|margin|distance|first.?order|pune|bengaluru|hour|complaint/i.test(
        opts.learnerText,
      );
    if (!precise) {
      return {
        text: "Can you make that more specific — which metric, which segment, which comparison, and which time window?",
        returned_data: false,
      };
    }
    return {
      text: "From the pull: customers with a clean first order (under 12 min, no complaint) repeat at ~31%; late or wrong first orders repeat at ~6%. Coupon-acquired customers repeat at ~8% vs ~25% organic. (Demo reply — add OPENROUTER_API_KEY for live answers.)",
      returned_data: true,
    };
  }
  return {
    text: `Got it — I'll think on that. (Demo mode: set OPENROUTER_API_KEY in .env for live ${opts.name} replies.)`,
  };
}
