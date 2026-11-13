import { expect, test } from "@playwright/test";

import { PARENT_STORAGE_STATE, signInAsChild } from "./fixtures";

const ANONYMOUS = { storageState: { cookies: [], origins: [] } };

test.describe("phase 4: Home Port quest board and crew camp", () => {
  test.use({ storageState: PARENT_STORAGE_STATE });

  test("quest board lists quests; crew camp equips and unequips owned gear", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "mutating flow runs once, on desktop");
    test.setTimeout(120_000);

    // Give Ava coins so she can own a cosmetic regardless of earlier runs.
    await page.goto("/parent/rewards");
    const adjust = page.locator("form", {
      has: page.getByRole("button", { name: "Record adjustment" }),
    });
    await adjust.getByLabel("Child").selectOption({ label: "Ava" });
    await adjust.getByLabel("Currency").selectOption("COINS");
    await adjust.getByLabel("Amount (+/−)").fill("100");
    await adjust.getByLabel("Reason").fill("E2E crew camp coins");
    await adjust.getByRole("button", { name: "Record adjustment" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Adjustment recorded");

    const ctx = await browser.newContext(ANONYMOUS);
    const child = await ctx.newPage();
    await signInAsChild(page, child, "Ava", "1234");

    // Make sure the adventure is started (idempotent on re-runs).
    await child.goto("/child/adventure");
    const start = child.getByRole("button", { name: /sail|start/i });
    if ((await start.count()) > 0) await start.first().click();

    // Quest board
    await child.getByRole("button", { name: "More" }).click();
    await child.locator('a[href="/child/port"]').click();
    await child.getByRole("link", { name: /Quest board/ }).click();
    await expect(child.getByRole("heading", { name: "Quest board", exact: true })).toBeVisible();
    const cards = child.getByTestId("quest-card");
    await expect(cards.first()).toBeVisible();
    await expect(child.getByTestId("quest-reward").first()).toContainText("Reward:");
    // Touch target of the back link.
    const back = child.getByRole("link", { name: "← Home Port" });
    expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await back.click();

    // Make sure Ava owns the captain's hat.
    await child.getByRole("link", { name: /Supply shop/ }).click();
    await expect(child.getByRole("heading", { name: "Supply shop" })).toBeVisible();
    await expect(child.getByTestId("supply-shop")).toBeVisible();
    const hat = child.getByTestId("buy-cosmetic-captain-hat");
    if ((await hat.count()) > 0 && (await hat.isEnabled())) {
      await hat.click();
      await expect(child.locator("[data-sonner-toast]").first()).toContainText("You bought");
    }

    // Crew camp
    await child.goto("/child/port/crew-camp");
    await expect(child.getByRole("heading", { name: "Crew camp", exact: true })).toBeVisible();
    const slot = child.getByTestId("camp-slot-head");
    const wear = slot.getByTestId("equip-cosmetic-captain-hat");
    if ((await wear.count()) > 0) {
      expect((await wear.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await wear.click();
    }
    await expect(slot.locator('[data-worn="true"]')).toContainText("Wearing this");
    await child.reload();
    await expect(child.getByTestId("camp-slot-head").locator('[data-worn="true"]')).toBeVisible();

    await child.getByTestId("unequip-cosmetic-captain-hat").click();
    await expect(child.getByTestId("camp-slot-head").locator('[data-worn="true"]')).toHaveCount(0);
    await ctx.close();
  });

  test("child pages reject anonymous visitors", async ({ browser }) => {
    const ctx = await browser.newContext(ANONYMOUS);
    const anon = await ctx.newPage();
    for (const path of ["/child/port", "/child/port/quest-board", "/child/port/crew-camp"]) {
      await anon.goto(path);
      await expect(anon).toHaveURL(/child\/sign-in/);
    }
    await ctx.close();
  });
});
