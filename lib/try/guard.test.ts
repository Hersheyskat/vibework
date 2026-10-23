import { describe, expect, it } from "vitest";
import { guardJobInput, linkOnly } from "./guard";

describe("guardJobInput", () => {
  it("detects bare links", () => {
    expect(linkOnly("https://linkedin.com/jobs/view/123")).toBe(true);
    expect(linkOnly("www.naukri.com/job/xyz")).toBe(true);
    expect(
      linkOnly(
        "Product Manager at a food delivery app — own retention and pricing.",
      ),
    ).toBe(false);
  });

  it("rejects empty and link-only input", () => {
    expect(guardJobInput("").ok).toBe(false);
    expect(guardJobInput("https://only.a/link").ok).toBe(false);
  });

  it("accepts a typed role", () => {
    const ok = guardJobInput("Retail Store Manager at an apparel chain");
    expect(ok.ok).toBe(true);
  });
});
