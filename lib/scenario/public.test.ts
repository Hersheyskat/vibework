import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalize } from "./normalize";
import { containsSecretKeys, toPublicGame } from "./public";
import { freshGameState } from "@/lib/try/engine/types";

describe("public allowlist", () => {
  it("does not leak secret fields from the example bundle", () => {
    const raw = JSON.parse(
      readFileSync(
        resolve("scenarios/example/example-bundle-zippy-medium.json"),
        "utf8",
      ),
    );
    const bundle = normalize(raw, "medium")!;
    const state = freshGameState(bundle);
    const pub = toPublicGame({
      gameId: "g1",
      runId: "r1",
      level: "medium",
      bundle,
      state,
    });
    const leaks = containsSecretKeys(pub);
    expect(leaks).toEqual([]);
    const text = JSON.stringify(pub);
    expect(text).not.toMatch(/hidden_facts/);
    expect(text).not.toMatch(/world_briefing/);
    expect(text).not.toMatch(/persona/);
    expect(text).not.toMatch(/expected_answers/);
    expect(text).not.toMatch(/"ledger"/);
    expect(pub.feedback).toBeNull();
    expect(pub.dayOver).toBe(false);
  });

  it("exposes expectedAnswer only after scoring", () => {
    const raw = JSON.parse(
      readFileSync(
        resolve("scenarios/example/example-bundle-zippy-medium.json"),
        "utf8",
      ),
    );
    const bundle = normalize(raw, "medium")!;
    const state = freshGameState(bundle);
    const scored = toPublicGame({
      gameId: "g1",
      runId: "r1",
      level: "medium",
      bundle,
      state,
      feedback: {
        verdict: "Solid start",
        scores: bundle.track.skills.map((s) => ({
          skill: s.name || "Skill",
          score: 3,
          evidence: "ok",
        })),
        strengths: [],
        improve: [],
        tasks: [],
        senior: "",
        missed: [],
        drill: "practice",
      },
    });
    expect(scored.feedback?.total).toBe(18);
    expect(scored.tasks[0]?.expectedAnswer).toBeTruthy();
    expect(containsSecretKeys(scored)).toEqual([]);
  });
});
