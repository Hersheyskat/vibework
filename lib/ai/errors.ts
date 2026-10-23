/** Friendly copy for AI / API failures (prototype copyFor + OpenRouter). */
export function copyFor(code: string): string {
  const map: Record<string, string> = {
    not_granted:
      "AI access wasn't allowed. Check OPENROUTER_API_KEY and try again.",
    rate_limited:
      "Too many requests too fast, or you've hit a usage limit. Wait a minute and try again.",
    session_expired: "The AI session expired. Try again.",
    refused: "That request couldn't be answered. Try wording it differently.",
    sampling_disabled: "This model isn't available on the OpenRouter key.",
    prompt_too_large:
      "That's too much text. Shorten the job post and try again.",
    invalid_json: "The AI's answer came back garbled. Try again.",
    missing_key: "OPENROUTER_API_KEY is not set on the server.",
    timeout: "The AI took too long. Try again.",
  };
  return map[code] || "The reply didn't come through. Try again.";
}

export class AiError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || copyFor(code));
    this.code = code;
    this.name = "AiError";
  }
}
