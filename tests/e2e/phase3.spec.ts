import { expect, test } from "@playwright/test";

import { PARENT_STORAGE_STATE, signInAsChild } from "./fixtures";

const ANONYMOUS = { storageState: { cookies: [], origins: [] } };

test.describe("phase 3: goals, rewards, notifications, audit", () => {
  test.use({ storageState: PARENT_STORAGE_STATE });

  test("goals: create, edit, recalculate and archive then restore", async ({ page, isMobile }) => {
    test.skip(isMobile, "mutating flow runs once, on desktop");
    await page.goto("/parent/goals");
    const title = `E2E goal ${Date.now()}`;
    const form = page.locator("form", { has: page.getByRole("button", { name: "Create goal" }) });
    await form.getByLabel("Title").fill(title);
    await form.getByRole("button", { name: "Create goal" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Goal created");

    await page.reload();
    const row = page.getByTestId("goal-row").filter({ hasText: title });
    await row.getByText(`Edit “${title}”`).click();
    await row.getByLabel("Target", { exact: true }).fill("9");
    await row.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Goal updated");
    await expect(row.getByText(/Resets|Does not reset/)).toBeVisible();

    await row.getByRole("button", { name: "Recalculate progress" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("recalculated");

    await row.getByRole("button", { name: "Archive goal" }).click();
    const archived = page.locator("#archived-goals + ul li", { hasText: title });
    await expect(archived).toBeVisible();
    await archived.getByRole("button", { name: "Restore goal" }).click();
    await expect(page.getByTestId("goal-row").filter({ hasText: title })).toBeVisible();
  });

  test("rewards: parent adds a reward, child requests it, parent declines and points come back", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "mutating flow runs once, on desktop");
    test.setTimeout(120_000);
    await page.goto("/parent/rewards");

    // Give Ava some points through a manual adjustment.
    const adjust = page.locator("form", {
      has: page.getByRole("button", { name: "Record adjustment" }),
    });
    await adjust.getByLabel("Child").selectOption({ label: "Ava" });
    await adjust.getByLabel("Amount (+/−)").fill("60");
    await adjust.getByLabel("Reason").fill("E2E bonus");
    await adjust.getByRole("button", { name: "Record adjustment" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Adjustment recorded");

    const name = `E2E treat ${Date.now()}`;
    const add = page.locator("form", { has: page.getByRole("button", { name: "Add reward" }) });
    await add.getByLabel("Reward", { exact: true }).fill(name);
    await add.getByLabel("Price (points)").fill("25");
    await add.getByLabel("How many (optional)").fill("1");
    await add.getByRole("button", { name: "Add reward" }).click();
    await expect(page.getByTestId("reward-catalogue")).toContainText(name);
    await expect(
      page.getByTestId("reward-catalogue").locator("li", { hasText: name }),
    ).toContainText("1 left");

    const ctx = await browser.newContext(ANONYMOUS);
    const child = await ctx.newPage();
    await signInAsChild(page, child, "Ava", "1234");
    await child.getByRole("button", { name: "More" }).click();
    await child.getByRole("link", { name: "Reward shop" }).click();
    const item = child.getByTestId("reward-shop").locator("> div", { hasText: name });
    await expect(item).toContainText("1 left");
    await item.getByRole("button", { name: "I want this!" }).click();
    await expect(child.getByTestId("my-requests")).toContainText(name);
    await expect(child.getByTestId("my-requests")).toContainText("Waiting");
    // Sold out now, and the other child cannot be told anything about Ava's request.
    await expect(
      child.getByTestId("reward-shop").locator("> div", { hasText: name }),
    ).toContainText("All gone for now");

    // Parent sees the request in the queue and an unread notification.
    await page.goto("/parent/rewards");
    const request = page.getByTestId("redemption-requests").locator("> div", { hasText: name });
    await expect(request).toContainText("Ava");
    await request.getByLabel("Note for the child (optional)").fill("Not today");
    await request.getByTestId("redeem-deny").click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText(
      "child will be notified",
    );

    await page.goto("/parent/notifications");
    await expect(page.getByTestId("notification-list")).toContainText(`asked for “${name}”`);

    // Child gets the answer with the parent's note, and the shop stocks the item again.
    await child.goto("/child/notifications");
    await expect(child.getByTestId("notification-list")).toContainText(
      `“${name}” was not approved`,
    );
    await expect(child.getByTestId("notification-list")).toContainText("Not today");
    await child.goto("/child/rewards");
    await expect(
      child.getByTestId("reward-shop").locator("> div", { hasText: name }),
    ).toContainText("1 left");

    // The audit log shows readable text, never raw JSON.
    await page.goto("/parent/audit?prefix=reward");
    const audit = page.getByTestId("audit-list");
    await expect(audit).toContainText("Declined reward");
    await expect(audit).not.toContainText("{");
    await expect(audit).not.toContainText("costPoints");

    // Clean up: archive the reward so reruns start from the same shop.
    await page.goto("/parent/rewards");
    await page
      .getByTestId("reward-catalogue")
      .locator("li", { hasText: name })
      .getByRole("button", { name: "Archive" })
      .click();
    await ctx.close();
  });

  test("audit log: filters and bad parameters are handled", async ({ page }) => {
    await page.goto("/parent/audit");
    await expect(page.getByRole("heading", { name: "Activity log" })).toBeVisible();
    await page.goto("/parent/audit?prefix=reward&from=2020-01-01&to=2099-01-01");
    await expect(page.getByRole("heading", { name: "Activity log" })).toBeVisible();
    await page.goto("/parent/audit?prefix=%25%25&cursor=garbage&from=nonsense");
    await expect(page.getByRole("heading", { name: "Activity log" })).toBeVisible();
  });

  test("notifications page renders for the parent", async ({ page }) => {
    await page.goto("/parent/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    await expect(page.getByTestId("notification-list")).toBeVisible();
  });

  test("mobile navigation keeps every page reachable through More", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile layout only");
    await page.goto("/parent");
    await page.getByRole("button", { name: /More/ }).click();
    await page.getByRole("link", { name: "Log" }).click();
    await expect(page).toHaveURL(/\/parent\/audit/);
  });
});

test.describe("phase 3: child pages", () => {
  test.use({ storageState: PARENT_STORAGE_STATE });

  test("achievements show hints while locked and the shop and news pages render", async ({
    page,
    browser,
    isMobile,
  }) => {
    test.skip(isMobile, "desktop only");
    const ctx = await browser.newContext(ANONYMOUS);
    const child = await ctx.newPage();
    await signInAsChild(page, child, "Max", "5678");

    await child.getByRole("button", { name: "More" }).click();
    await child.getByRole("link", { name: /Badges/ }).click();
    await expect(child).toHaveURL(/\/child\/achievements$/);
    const gallery = child.getByTestId("achievement-gallery");
    await expect(gallery).toBeVisible();
    const locked = gallery.locator('[data-earned="false"]').first();
    await expect(locked).toContainText("Hint:");
    // The locked card must not spell out the secret condition.
    const lockedText = (await gallery.locator('[data-earned="false"]').allTextContents()).join(" ");
    expect(lockedText).not.toMatch(/Complete (ten|your)/);

    await child.goto("/child/rewards");
    await expect(child.getByRole("heading", { name: "Reward shop" })).toBeVisible();
    await child.goto("/child/notifications");
    await expect(child.getByRole("heading", { name: "News from the crew" })).toBeVisible();
    await expect(child.getByTestId("child-bell")).toBeVisible();

    // A child cannot open the parent's audit log or inbox.
    await child.goto("/parent/audit");
    await expect(child).toHaveURL(/\/sign-in/);
    await ctx.close();
  });
});
