import {
  createGame,
  getGameForUser,
  getPassingPlanBundle,
  getPlanBundle,
  getRunLevel,
  saveGameState,
  type GameRow,
} from "@/lib/db/games";
import { toPublicGame } from "@/lib/scenario/public";
import type { ScenarioBundle } from "@/lib/scenario/schema";
import type { GameState } from "@/lib/try/engine/types";

export type LoadedGame = {
  row: GameRow;
  bundle: ScenarioBundle;
  level: string;
};

export async function loadOwnedGame(
  gameId: string,
  userId: string,
): Promise<LoadedGame | null> {
  const row = await getGameForUser(gameId, userId);
  if (!row) return null;
  const bundle = await getPlanBundle(row.planId);
  if (!bundle) return null;
  const level = (await getRunLevel(row.runId)) || "beginner";
  return { row, bundle, level };
}

export function publicPayload(loaded: LoadedGame) {
  return toPublicGame({
    gameId: loaded.row.id,
    runId: loaded.row.runId,
    level: loaded.level,
    bundle: loaded.bundle,
    state: loaded.row.state,
  });
}

export async function persistState(gameId: string, state: GameState) {
  await saveGameState(gameId, state);
}

export async function startGameFromRun(opts: {
  userId: string;
  runId: string;
}): Promise<{ gameId: string } | { error: string; status: number }> {
  const plan = await getPassingPlanBundle(opts.runId);
  if (!plan) {
    return {
      error: "No passing plan for this run yet",
      status: 404,
    };
  }
  const gameId = await createGame({
    userId: opts.userId,
    runId: opts.runId,
    planId: plan.planId,
    bundle: plan.bundle,
  });
  return { gameId };
}
