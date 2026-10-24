import { describe, expect, it } from "vitest";
import { chatCapExceeded, countPlayerChats } from "./caps";

describe("chat caps", () => {
  it("counts player messages across threads", () => {
    expect(
      countPlayerChats({
        a: [{ f: "me" }, { f: "them" }, { f: "me" }],
        assist: [{ f: "me" }],
      }),
    ).toBe(3);
  });

  it("blocks at the configured chat cap", () => {
    const threads: Record<string, { f: string }[]> = {
      boss: Array.from({ length: 60 }, () => ({ f: "me" })),
    };
    expect(chatCapExceeded(threads)).toMatch(/60 chat messages/);
    threads.boss!.pop();
    expect(chatCapExceeded(threads)).toBeNull();
  });
});
