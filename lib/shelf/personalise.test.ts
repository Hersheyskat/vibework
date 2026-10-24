import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalize } from "@/lib/scenario/normalize";
import { matchRoleKeyByAlias } from "./catalog";
import { personaliseShelfBundle } from "./personalise";

describe("shelf match aliases", () => {
  it("maps common titles to shelf keys", () => {
    expect(matchRoleKeyByAlias("Product Manager")).toBe("product-manager");
    expect(matchRoleKeyByAlias("Customer Support Executive at a food app")).toBe(
      "customer-support-executive",
    );
    expect(matchRoleKeyByAlias("Tea Estate Assistant Manager")).toBeNull();
  });
});

describe("personaliseShelfBundle", () => {
  it("updates title/theme without touching ledger numbers", () => {
    const raw = JSON.parse(
      readFileSync(
        resolve("scenarios/example/example-bundle-zippy-medium.json"),
        "utf8",
      ),
    );
    const b = normalize(raw, "medium")!;
    const ledger0 = b.ledger[0]!.value;
    const fact0 = b.day.characters.find((c) => c.hidden_facts.length)?.hidden_facts[0]
      ?.fact;

    const { bundle, ok } = personaliseShelfBundle(
      b,
      {
        is_job: true,
        role_title: "Associate Product Manager",
        industry: "Tech",
        location_hint: "Pune",
        regulation: "none",
        reason: "",
        employer_names: [],
        adjacent_roles: [],
      },
      "medium",
    );
    expect(ok).toBe(true);
    expect(bundle.track.title).toContain("Associate Product Manager");
    expect(bundle.day.theme).toContain("Pune");
    expect(bundle.ledger[0]!.value).toBe(ledger0);
    const factAfter = bundle.day.characters.find((c) => c.hidden_facts.length)
      ?.hidden_facts[0]?.fact;
    expect(factAfter).toBe(fact0);
  });
});
