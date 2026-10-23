import { describe, expect, it } from "vitest";
import { coerceBundle } from "./coerce";
import { normalize } from "./normalize";
import { codeChecks } from "./checks";

describe("coerceBundle", () => {
  it("lifts day.inbox into day.public.inbox and seeds characters from cast", () => {
    const raw = {
      track: {
        role: "PM",
        company: {
          name: "AcmeCo",
          one_liner: "x",
          world_briefing: "y",
        },
        style_rules: "short",
        skills: [
          { id: "a", name: "A", description: "d" },
          { id: "b", name: "B", description: "d" },
          { id: "c", name: "C", description: "d" },
          { id: "d", name: "D", description: "d" },
          { id: "e", name: "E", description: "d" },
          { id: "f", name: "F", description: "d" },
        ],
        cast: [
          {
            id: "priya",
            name: "Priya",
            role: "boss",
            persona: "You are Priya",
          },
          {
            id: "ravi",
            name: "Ravi",
            role: "analyst",
            persona: "You are Ravi",
            reply_flags: ["returned_data"],
            limits: { data_pulls: 18 },
            hidden_facts: [
              { id: "f1", fact: "1", reveal_if: "ask" },
              { id: "f2", fact: "2", reveal_if: "ask" },
              { id: "f3", fact: "3", reveal_if: "ask" },
              { id: "f4", fact: "4", reveal_if: "ask" },
            ],
          },
          { id: "sam", name: "Sam", role: "ops", persona: "You are Sam" },
          {
            id: "adi",
            name: "Adi",
            role: "growth",
            persona: "You are Adi",
            available: "locked",
          },
          { id: "kira", name: "Kira", role: "eng", persona: "You are Kira" },
        ],
      },
      day: {
        title: "Day",
        theme: "theme",
        story_so_far: "so far",
        world_today: "today",
        canon_after_day: "after",
        inbox: [
          {
            from: "priya",
            time: "09:02",
            subject: "Hi",
            body: "Welcome",
          },
        ],
        dashboard: {
          title: "Dash",
          subtitle: "sub",
          columns: ["M", "A", "B", "T"],
          rows: [
            { cells: ["x", "1", "2", "3"] },
            { cells: ["y", "1", "2", "3"] },
            { cells: ["z", "1", "2", "3"] },
            { cells: ["w", "1", "2", "3"] },
          ],
          notes: [],
        },
        tasks: [
          {
            id: "hypothesis",
            title: "t1",
            description: "d",
            kind: "sub",
            submit_to: "priya",
            done_when: { submitted: "hypothesis" },
          },
          {
            id: "data",
            title: "t2",
            description: "d",
            kind: "chat",
            done_when: {
              counter_at_least: { counter: "ravi.data_pulls", value: 1 },
            },
          },
          {
            id: "twist",
            title: "t3",
            description: "d",
            kind: "chat",
            done_when: { messages_sent: { to: "adi", at_least: 1 } },
          },
          {
            id: "memo",
            title: "t4",
            description: "d",
            kind: "submission",
            submit_to: "priya",
            done_when: { submitted: "memo" },
          },
        ],
        triggers: [
          {
            id: "twist",
            when: { submitted: "hypothesis" },
            do: [
              { unlock: "adi" },
              { message: { from: "adi", text: "hey" } },
            ],
          },
        ],
        clock: { start: "09:00", end: "17:30", steps: [] },
        scoring: {
          strong_player: "x",
          expected_answers: {
            hypothesis: "a",
            data: "b",
            twist: "c",
            memo: "d",
          },
        },
      },
      ledger: [
        { id: "a", label: "A (%)", value: 10 },
        { id: "b", label: "B (%)", value: 20 },
        { id: "c", label: "C", value: 30, formula: "a+b" },
        { id: "d", label: "D", value: 5 },
        { id: "e", label: "E", value: 15, formula: "a+d" },
        { id: "f", label: "F", value: 25, formula: "b+d" },
        { id: "g", label: "G", value: 35, formula: "c+d" },
      ],
      claims: [
        { text: "a < b", left: "a", op: "<", right: "b" },
        { text: "d < a", left: "d", op: "<", right: "a" },
        { text: "a < c", left: "a", op: "<", right: "c" },
      ],
    };

    const coerced = coerceBundle(raw) as {
      day: {
        public: { inbox: unknown[] };
        characters: unknown[];
        tasks: { id: string; kind: string }[];
        scoring: { expected_answers: Record<string, string> };
      };
    };
    expect(coerced.day.public.inbox.length).toBe(1);
    expect(coerced.day.characters.length).toBe(5);
    expect(coerced.day.tasks.map((t) => t.id)).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
    ]);
    expect(coerced.day.tasks[0]!.kind).toBe("submission");
    expect(coerced.day.scoring.expected_answers.t1).toBe("a");

    const bundle = normalize(coerced, "medium");
    expect(bundle).not.toBeNull();
    const fails = codeChecks(bundle!, "medium", null).filter(
      (c) => c.status === "fail",
    );
    // Coerce alone may not pass every check, but format/cast should improve
    expect(
      fails.some((f) => f.name.includes("Format") && f.detail.includes("inbox")),
    ).toBe(false);
    expect(
      fails.some((f) => f.detail.includes("colleagues, has -1")),
    ).toBe(false);
  });
});
