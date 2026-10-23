import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/db/admin";
import { games, runs } from "@/lib/db/schema";

function usePg() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

export type MyDayItem = {
  runId: string;
  gameId: string | null;
  level: string;
  runStatus: string;
  gameStatus: string | null;
  company: string | null;
  role: string | null;
  inputPreview: string;
  createdAt: string;
  href: string;
  actionLabel: string;
};

type SummaryShape = {
  company?: { name?: string };
  role?: string;
};

function preview(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 100 ? `${t.slice(0, 100)}…` : t;
}

function fromSummary(screenJson: unknown): {
  company: string | null;
  role: string | null;
} {
  const payload = screenJson as { summary?: SummaryShape } | null;
  const s = payload?.summary;
  return {
    company: s?.company?.name?.trim() || null,
    role: s?.role?.trim() || null,
  };
}

function linkAndLabel(
  runId: string,
  runStatus: string,
  gameId: string | null,
  gameStatus: string | null,
): { href: string; actionLabel: string } {
  if (gameId) {
    if (gameStatus === "scored") {
      return { href: `/games/${gameId}`, actionLabel: "View day" };
    }
    return { href: `/games/${gameId}`, actionLabel: "Resume" };
  }
  if (
    runStatus === "ready" ||
    runStatus === "failed" ||
    runStatus === "blocked"
  ) {
    return { href: `/runs/${runId}`, actionLabel: "Open" };
  }
  return { href: `/runs/${runId}`, actionLabel: "Continue building" };
}

function mapItem(opts: {
  runId: string;
  inputText: string;
  level: string;
  runStatus: string;
  screenJson: unknown;
  createdAt: string;
  gameId: string | null;
  gameStatus: string | null;
}): MyDayItem {
  const { company, role } = fromSummary(opts.screenJson);
  const { href, actionLabel } = linkAndLabel(
    opts.runId,
    opts.runStatus,
    opts.gameId,
    opts.gameStatus,
  );
  return {
    runId: opts.runId,
    gameId: opts.gameId,
    level: opts.level,
    runStatus: opts.runStatus,
    gameStatus: opts.gameStatus,
    company,
    role,
    inputPreview: preview(opts.inputText),
    createdAt: opts.createdAt,
    href,
    actionLabel,
  };
}

export async function listMyDays(userId: string): Promise<MyDayItem[]> {
  if (usePg()) {
    const db = getDb();
    const runRows = await db
      .select()
      .from(runs)
      .where(eq(runs.userId, userId))
      .orderBy(desc(runs.createdAt))
      .limit(50);

    const gameRows = await db
      .select()
      .from(games)
      .where(eq(games.userId, userId))
      .orderBy(desc(games.startedAt))
      .limit(100);

    const latestGameByRun = new Map<
      string,
      { id: string; status: string }
    >();
    for (const g of gameRows) {
      if (!latestGameByRun.has(g.runId)) {
        latestGameByRun.set(g.runId, { id: g.id, status: g.status });
      }
    }

    return runRows.map((r) => {
      const g = latestGameByRun.get(r.id) ?? null;
      return mapItem({
        runId: r.id,
        inputText: r.inputText,
        level: r.level,
        runStatus: r.status,
        screenJson: r.screenJson,
        createdAt:
          r.createdAt instanceof Date
            ? r.createdAt.toISOString()
            : String(r.createdAt),
        gameId: g?.id ?? null,
        gameStatus: g?.status ?? null,
      });
    });
  }

  const sb = getSupabaseAdmin();
  const { data: runData, error: runErr } = await sb
    .from("runs")
    .select("id, input_text, level, status, screen_json, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (runErr) throw new Error(runErr.message);

  const { data: gameData, error: gameErr } = await sb
    .from("games")
    .select("id, run_id, status, started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(100);
  if (gameErr) throw new Error(gameErr.message);

  const latestGameByRun = new Map<string, { id: string; status: string }>();
  for (const g of gameData || []) {
    const runId = g.run_id as string;
    if (!latestGameByRun.has(runId)) {
      latestGameByRun.set(runId, {
        id: g.id as string,
        status: g.status as string,
      });
    }
  }

  return (runData || []).map((r) => {
    const g = latestGameByRun.get(r.id as string) ?? null;
    return mapItem({
      runId: r.id as string,
      inputText: String(r.input_text || ""),
      level: r.level as string,
      runStatus: r.status as string,
      screenJson: r.screen_json,
      createdAt: String(r.created_at),
      gameId: g?.id ?? null,
      gameStatus: g?.status ?? null,
    });
  });
}
