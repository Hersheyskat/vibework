import { NextResponse } from "next/server";
import { z } from "zod";
import { openRouterConfigured } from "@/lib/ai/client";
import { hasDbAccess } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import {
  afterPlayerMessage,
  applyPlayerMessage,
} from "@/lib/try/actions";
import {
  loadOwnedGame,
  persistState,
  publicPayload,
} from "@/lib/try/load-game";

const bodySchema = z.object({
  to: z.string().min(1),
  text: z.string().min(1),
});

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!hasDbAccess()) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }
  if (!openRouterConfigured()) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not set" },
      { status: 503 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const loaded = await loadOwnedGame(id, user.id);
  if (!loaded) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const applied = applyPlayerMessage(
    loaded.row.state,
    loaded.bundle,
    parsed.data.to,
    parsed.data.text,
  );
  if (!applied.ok) {
    return NextResponse.json({ error: applied.error }, { status: 400 });
  }

  await persistState(id, loaded.row.state);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEncode(event, data)));
      };
      try {
        send("state", publicPayload(loaded));
        const replyText = await afterPlayerMessage({
          state: loaded.row.state,
          bundle: loaded.bundle,
          to: parsed.data.to,
          gameId: id,
          runId: loaded.row.runId,
        });
        await persistState(id, loaded.row.state);

        // Stream reply in small chunks for typing feel
        const chunk = 24;
        for (let i = 0; i < replyText.length; i += chunk) {
          send("delta", { text: replyText.slice(i, i + chunk) });
        }
        send("done", { game: publicPayload(loaded), reply: replyText });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Reply failed";
        send("error", { error: message });
        try {
          loaded.row.state.threads[parsed.data.to]?.push({
            f: "sys",
            t: "Couldn't get a reply just now. Try again in a moment.",
          });
          await persistState(id, loaded.row.state);
          send("done", { game: publicPayload(loaded) });
        } catch {
          /* ignore */
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
