/** Lightweight PostHog capture (no SDK). No-op without POSTHOG_KEY. */
export async function capturePosthog(
  event: string,
  props: Record<string, unknown>,
  distinctId?: string | null,
): Promise<void> {
  const key = process.env.POSTHOG_KEY?.trim();
  if (!key) return;
  const host = (
    process.env.POSTHOG_HOST || "https://us.i.posthog.com"
  ).replace(/\/$/, "");
  try {
    await fetch(`${host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        event,
        properties: {
          ...props,
          distinct_id: distinctId || "anonymous",
          $lib: "vibework-server",
        },
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (e) {
    console.error("[vibework] posthog capture failed", e);
  }
}
