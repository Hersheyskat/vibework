import { expect, test } from "@playwright/test";

test.describe("setup screen", () => {
  test("shows brand and build CTA", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Vibe check any job/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /Build my work-day/i }),
    ).toBeVisible();
  });

  test("admin runs page is gated", async ({ page }) => {
    const res = await page.goto("/admin/runs");
    // Signed-out → redirect home; non-admin → 404 (no admin leak).
    const status = res?.status() ?? 0;
    expect([200, 302, 307, 404]).toContain(status);
    await expect(page.locator("body")).toContainText(
      /Vibe check|Sign in|Not Found|404|Couldn.t find/i,
      { timeout: 20_000 },
    );
  });
});
