import { expect, test, type Page } from "@playwright/test";

const mockGame = {
  gameId: "e2e-game",
  runId: "e2e-run",
  level: "medium",
  status: "playing",
  dayOver: false,
  scored: false,
  hasFeedback: false,
  clock: "9:15",
  view: "brief",
  next: { message: "Read your inbox", view: "brief" },
  toast: null,
  company: { name: "Zippy", one_liner: "10-minute grocery" },
  role: "Product Manager",
  title: "PM, Café",
  theme: "reorder",
  practised: ["Prioritisation"],
  skills: [{ id: "s1", name: "Prioritisation", description: "" }],
  public: {
    inbox: [
      {
        from: "priya",
        time: "9:02",
        subject: "Kick-off",
        body: "Look at Café reorder today.",
      },
    ],
    dashboard: { title: "Café", columns: ["Metric"], rows: [], notes: [] },
    reviews: [],
    documents: [],
  },
  mentor: { name: "Ananya", title: "Mentor" },
  characters: [
    {
      id: "priya",
      name: "Priya Shah",
      role: "Boss",
      available: true,
      locked: false,
      isBoss: true,
      isInfoSource: false,
      chatLocked: false,
      unread: 0,
    },
  ],
  tasks: [
    {
      id: "t1",
      title: "Diagnosis note",
      minutes: 20,
      kind: "submission",
      description: "Write a short diagnosis.",
      submit_to: "priya",
      done: false,
      submitted: false,
      submission: null,
      revisions: 0,
      canRevise: false,
      revising: false,
      draft: "",
    },
  ],
  threads: {
    priya: [{ from: "them", text: "Morning — start with the inbox." }],
    assist: [] as { from: string; text: string }[],
    mentor: [] as { from: string; text: string }[],
  } as Record<string, { from: string; text: string }[]>,
  drafts: {},
  unread: { priya: 0, assist: 0, mentor: 0 },
  support: {
    assist: {
      id: "assist",
      name: "Saathi",
      role: "Your AI assistant",
      unread: 0,
    },
    mentor: {
      id: "mentor",
      name: "Ananya",
      role: "Your mentor",
      unread: 0,
    },
  },
  feedback: null,
  learning: [],
  drill: null,
  seniorView: null,
};

async function stubGameApis(page: Page) {
  let game = structuredClone(mockGame);
  await page.route("**/api/games/e2e-game/**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    if (url.includes("/view") && method === "POST") {
      const body = route.request().postDataJSON() as { view?: string };
      if (body.view) game.view = body.view;
      await route.fulfill({ json: game });
      return;
    }
    if (url.includes("/drafts")) {
      await route.fulfill({ json: { ok: true } });
      return;
    }
    if (url.includes("/messages") && method === "POST") {
      const body = route.request().postDataJSON() as {
        to: string;
        text: string;
      };
      game.threads[body.to] = [
        ...(game.threads[body.to] || []),
        { from: "me", text: body.text },
        { from: "them", text: "Got it — send numbers next time." },
      ];
      const payload = `event: done\ndata: ${JSON.stringify({ game, reply: "Got it — send numbers next time." })}\n\n`;
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: payload,
      });
      return;
    }
    await route.fulfill({ json: game });
  });
  await page.route("**/api/games/e2e-game", async (route) => {
    await route.fulfill({ json: game });
  });
}

test.describe("play UI (AI mocked)", () => {
  test("inbox → chat → send message", async ({ page }) => {
    await stubGameApis(page);
    await page.goto("/games/e2e-game");
    await expect(page.getByRole("heading", { name: /Welcome to Zippy/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Kick-off/i)).toBeVisible();
    await page.getByRole("button", { name: /Priya/i }).first().click();
    await expect(
      page.getByText(/Morning — start with the inbox/i),
    ).toBeVisible();
    await page.locator(".compose textarea").fill("What is the reorder rate?");
    await page.locator(".compose").getByRole("button", { name: /^Send$/i }).click();
    await expect(page.getByText(/Got it — send numbers/i)).toBeVisible();
  });
});
