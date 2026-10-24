import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalize } from "@/lib/scenario/normalize";
import { freshGameState } from "@/lib/try/engine/types";
import { dayOver } from "./transcript";

describe("dayOver", () => {
  it("is false on a fresh game and true when every task is done", () => {
    const raw = JSON.parse(
      readFileSync(
        resolve("scenarios/example/example-bundle-zippy-medium.json"),
        "utf8",
      ),
    );
    const bundle = normalize(raw, "medium")!;
    const state = freshGameState(bundle);
    expect(dayOver(state, bundle)).toBe(false);

    state.sub.t1 = "first read";
    state.sub.t4 = "decision note";
    state.counters["lakshmi.data_pulls"] = 1;
    state.counters["aditya.messages"] = 1;
    expect(dayOver(state, bundle)).toBe(true);
  });
});
