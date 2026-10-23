/**
 * Legacy helpers for the handcrafted Zippy track.
 * Try generation uses lib/ai/client.ts (OpenRouter-only).
 */
import { completeText, openRouterConfigured, type ChatTurn } from "./client";

export { openRouterConfigured, type ChatTurn };

export async function chatCompletion(opts: {
  messages: ChatTurn[];
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  return completeText({
    job: "colleague",
    purpose: "legacy_track_chat",
    promptVersion: "legacy-v1",
    messages: opts.messages,
    temperature: opts.temperature,
    jsonMode: opts.jsonMode,
  });
}

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
      text: "From the pull: customers with a clean first order (under 12 min, no complaint) repeat at ~31%; late or wrong first orders repeat at ~6%. (Demo reply — live answers use OpenRouter.)",
      returned_data: true,
    };
  }
  return {
    text: `Got it — I'll think on that. (Demo mode for ${opts.name}.)`,
  };
}
