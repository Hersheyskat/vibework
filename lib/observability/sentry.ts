/** Minimal Sentry envelope (no SDK). No-op without SENTRY_DSN. */
export async function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) {
    console.error("[vibework]", err, context);
    return;
  }
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.replace(/^\//, "");
    const store = `${url.protocol}//${url.host}/api/${projectId}/store/`;
    const message =
      err instanceof Error ? err.message : String(err ?? "unknown");
    await fetch(store, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${publicKey}, sentry_client=vibework/0.1`,
      },
      body: JSON.stringify({
        message,
        level: "error",
        platform: "node",
        tags: context,
        exception: {
          values: [
            {
              type: err instanceof Error ? err.name : "Error",
              value: message,
            },
          ],
        },
      }),
    });
  } catch (e) {
    console.error("[vibework] sentry capture failed", e, err);
  }
}
