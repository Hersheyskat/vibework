import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { codeChecks } from "./checks";
import { normalize } from "./normalize";
import type { ScenarioBundle } from "./schema";

function loadExample(): ScenarioBundle {
  const raw = JSON.parse(
    readFileSync(
      resolve("scenarios/example/example-bundle-zippy-medium.json"),
      "utf8",
    ),
  );
  const b = normalize(raw, "medium");
  if (!b) throw new Error("example failed to normalize");
  return b;
}

function clone(b: ScenarioBundle): ScenarioBundle {
  return JSON.parse(JSON.stringify(b)) as ScenarioBundle;
}

function failNames(b: ScenarioBundle): string[] {
  return codeChecks(b, "medium", null)
    .filter((c) => c.status === "fail")
    .map((c) => c.name);
}

describe("codeChecks", () => {
  it("passes the Zippy medium example", () => {
    const b = loadExample();
    const checks = codeChecks(b, "medium", null);
    expect(checks.every((c) => c.status !== "fail")).toBe(true);
  });

  it("fails Numbers when a formula value is wrong", () => {
    const b = clone(loadExample());
    const entry = b.ledger.find((x) => x.id === "cust_all");
    if (!entry) throw new Error("missing cust_all");
    entry.value = 1;
    const fails = failNames(b);
    expect(fails).toContain("Numbers and conclusions add up");
    expect(fails).toHaveLength(1);
  });

  it("fails Numbers when a claim is false", () => {
    const b = clone(loadExample());
    const claim = b.claims.find((c) => c.op === "<" && c.left === "rep_all");
    if (!claim) throw new Error("missing claim");
    claim.op = ">";
    const fails = failNames(b);
    expect(fails).toContain("Numbers and conclusions add up");
    expect(fails).toHaveLength(1);
  });

  it("fails No real brands when a brand appears in the inbox", () => {
    const b = clone(loadExample());
    b.day.public.inbox[0]!.body += " Partner with Swiggy for delivery.";
    const fails = failNames(b);
    expect(fails).toContain("No real brands");
    expect(fails).toHaveLength(1);
  });

  it("fails No real brands for a look-alike company name", () => {
    const b = clone(loadExample());
    b.track.company!.name = "Swigy";
    const fails = failNames(b);
    expect(fails).toContain("No real brands");
    expect(fails).toHaveLength(1);
  });

  it("fails Wiring when a trigger points at a missing person", () => {
    const b = clone(loadExample());
    const twist = b.day.triggers.find((t) => t.id === "twist");
    const msg = twist?.do?.find((a) => a.message);
    if (!msg?.message) throw new Error("no twist message");
    msg.message.from = "nobody";
    const fails = failNames(b);
    expect(fails.some((n) => n.includes("tasks") || n.includes("twist"))).toBe(
      true,
    );
  });

  it("fails Format/Wiring when there are only three tasks", () => {
    const b = clone(loadExample());
    b.day.tasks = b.day.tasks.slice(0, 3);
    const fails = failNames(b);
    expect(fails.some((n) => n.includes("tasks") || n.includes("twist"))).toBe(
      true,
    );
  });
});
