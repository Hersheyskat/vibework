/** Shared validation helpers for chat message bodies. */
export const MAX_CHAT_IMAGES = 2;
export const MAX_IMAGE_CHARS = 900_000; // ~data URL after shrink

export function sanitizeChatImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    if (!item.startsWith("data:image/")) continue;
    if (item.length > MAX_IMAGE_CHARS) continue;
    out.push(item);
    if (out.length >= MAX_CHAT_IMAGES) break;
  }
  return out;
}
