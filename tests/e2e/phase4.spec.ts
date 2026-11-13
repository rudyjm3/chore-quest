import { expect, test } from "@playwright/test";

import { PARENT_STORAGE_STATE, signInAsChild } from "./fixtures";

const ANONYMOUS = { storageState: { cookies: [], origins: [] } };

test.describe("phase 4: supply shop and treasure chest", () => {
  test.use({ storageState: PARENT_STORAGE_STATE });

  test("a child buys a supply item and finds it in the treasure chest", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "mutating flow runs once, on desktop");
    test.setTimeout(120_000);

    await page.goto("/parent/rewards");
    const adjust = page.locator("form", {
      has: page.getByRole("button", { name: "Record adjustment" }),
    });
    await adjust.getByLabel("Child").selectOption({ label: "Max" });
    await adjust.getByLabel("Currency").selectOption("COINS");
    await adjust.getByLabel("Amount (+/−)").fill("200");
    await adjust.getByLabel("Reason").fill("E2E shop coins");
    await adjust.getByRole("button", { name: "Record adjustment" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Adjustment recorded");

    const ctx = await browser.newContext(ANONYMOUS);
    const child = await ctx.newPage();
    await signInAsChild(page, child, "Max", "5678");

    await child.getByRole("link", { name: "Supplies" }).click();
    await expect(child.getByRole("heading", { name: "Supply shop" })).toBeVisible();
    const shop = child.getByTestId("supply-shop");
    // Locked and unaffordable states are explained in words.
    await expect(shop.locator('[data-state="locked"]').first()).toContainText(/unlock|first|need/i);

    const available = shop.locator('[data-state="available"]').first();
    if ((await available.count()) === 0) {
      // A re-run against the same database: everything affordable is already owned.
      await expect(shop).toContainText("You already have this!");
    } else {
      const name = (await available.locator("p.text-lg").first().textContent())!.trim();
      await available.getByRole("button", { name: /^Buy / }).click();
      await expect(child.locator("[data-sonner-toast]").first()).toContainText(
        `You bought ${name}`,
      );
      await expect(shop.locator("li", { hasText: name })).toContainText("You already have this!");

      await child.getByRole("button", { name: "More" }).click();
      await child.getByRole("link", { name: "Treasure chest" }).click();
      await expect(child.getByRole("heading", { name: "Treasure chest" })).toBeVisible();
      await expect(child.locator("main")).toContainText(name);
    }
    await ctx.close();
  });
});
