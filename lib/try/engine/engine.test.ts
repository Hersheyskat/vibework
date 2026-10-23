import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalize } from "@/lib/scenario/normalize";
import type { ScenarioBundle } from "@/lib/scenario/schema";
import { clockText, evalCond, infoId, taskDone } from "./cond";
import { runTriggers } from "./triggers";
import { freshGameState } from "./types";

function load(): ScenarioBundle {
  const raw = JSON.parse(
    readFileSync(
      resolve("scenarios/example/example-bundle-zippy-medium.json"),
      "utf8",
    ),
  );
  const b = normalize(raw, "medium");
  if (!b) throw new Error("bad fixture");
  return b;
}

describe("try engine", () => {
  it("fires twist after t1 submit + one data pull", () => {
    const bundle = load();
    const state = freshGameState(bundle);
    state.sub.t1 = "diagnosis";
    runTriggers(state, bundle);
    expect(state.fired["boss-on-t1"]).toBe(true);
    expect(state.fired.twist).toBeFalsy();

    const lakshmi = infoId(bundle)!;
    state.counters[`${lakshmi}.data_pulls`] = 1;
    runTriggers(state, bundle);
    expect(state.fired.twist).toBe(true);
    expect(state.unlocked.aditya).toBe(true);
    expect(state.threads.aditya?.some((m) => m.f === "them")).toBe(true);
  });

  it("fires twist after two data pulls without t1", () => {
    const bundle = load();
    const state = freshGameState(bundle);
    const lakshmi = infoId(bundle)!;
    state.counters[`${lakshmi}.data_pulls`] = 2;
    runTriggers(state, bundle);
    expect(state.fired.twist).toBe(true);
  });

  it("moves clock as conditions hold", () => {
    const bundle = load();
    const state = freshGameState(bundle);
    expect(clockText(state, bundle)).toContain("09:00");
    state.sub.t1 = "x";
    expect(clockText(state, bundle)).toContain("11:30");
    state.counters["lakshmi.data_pulls"] = 1;
    expect(clockText(state, bundle)).toContain("01:00");
    state.fired.twist = true;
    expect(clockText(state, bundle)).toContain("02:15");
  });

  it("locks analyst chat at pull limit", () => {
    const bundle = load();
    const lakshmi = bundle.day.characters.find((c) => c.id === "lakshmi")!;
    expect(lakshmi.limits?.data_pulls).toBe(18);
    const state = freshGameState(bundle);
    state.counters["lakshmi.data_pulls"] = 18;
    expect(
      evalCond(
        { counter_at_least: { counter: "lakshmi.data_pulls", value: 18 } },
        state,
        bundle,
      ),
    ).toBe(true);
  });

  it("marks submission tasks done when submitted", () => {
    const bundle = load();
    const state = freshGameState(bundle);
    const t1 = bundle.day.tasks.find((t) => t.id === "t1")!;
    expect(taskDone(t1, state, bundle)).toBe(false);
    state.sub.t1 = "done";
    expect(taskDone(t1, state, bundle)).toBe(true);
  });
});
