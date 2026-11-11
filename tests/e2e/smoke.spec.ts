import { expect, test } from "@playwright/test";

import { DEMO_PARENT, PARENT_STORAGE_STATE, signInAsParent } from "./fixtures";

/** Child devices start with no cookies, even inside describes that reuse the parent session. */
const ANONYMOUS = { storageState: { cookies: [], origins: [] } };

/**
 * Smoke tests against the production build using the development fixtures
 * created by `pnpm db:seed:dev` (demo parent + family + children).
 */
test.describe("public routes", () => {
  test("landing page loads with the three entry points", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Everyday chores");
    const actions = page.getByTestId("landing-actions");
    await expect(actions.getByRole("link", { name: "Parent sign in" })).toBeVisible();
    await expect(actions.getByRole("link", { name: "Create a family" })).toBeVisible();
    await expect(actions.getByRole("link", { name: "I'm a kid" })).toBeVisible();
  });

  test("health endpoint reports ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ status: "ok", database: "ok" });
  });

  test("sign-in and child sign-in pages render", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByTestId("sign-in-form")).toBeVisible();
    await page.goto("/child/sign-in");
    await expect(page.getByTestId("child-signin-step-code")).toBeVisible();
  });

  test("security headers are present", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("protected routes reject anonymous access", () => {
  test("parent area redirects to sign-in", async ({ page }) => {
    await page.goto("/parent/approvals");
    await expect(page).toHaveURL(
      /\/sign-in\?next=%2Fparent%2Fapprovals|\/sign-in\?next=\/parent\/approvals/,
    );
  });

  test("child area redirects to child sign-in", async ({ page }) => {
    await page.goto("/child/adventure");
    await expect(page).toHaveURL(/\/child\/sign-in$/);
  });

  test("wrong parent password is rejected", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(DEMO_PARENT.email);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/sign-in/);
  });
});

test.describe("parent flow", () => {
  test.use({ storageState: PARENT_STORAGE_STATE });

  test("signed-in parent sees the dashboard shell and navigation", async ({ page }) => {
    await page.goto("/parent");
    await expect(page.getByTestId("parent-shell")).toBeVisible();
    await expect(page.locator('[data-testid="family-name"]:visible')).toContainText(
      "The Demo Crew",
    );
    await expect(page.getByTestId("dashboard-stats")).toBeVisible();
    const nav = page.locator('[data-testid^="parent-nav-"]:visible');
    await expect(nav.getByRole("link", { name: /Approvals/ })).toBeVisible();
    await page
      .getByRole("link", { name: /Children/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/parent\/children/);
    await expect(page.getByTestId("children-list")).toContainText("Ava");
  });

  test("a parent session does not grant child access", async ({ page }) => {
    await page.goto("/parent");
    await page.goto("/child");
    await expect(page).toHaveURL(/\/child\/sign-in$/);
  });
});

test.describe("child flow", () => {
  // The parent page only reads the family code; children sign in in a fresh context.
  test.use({ storageState: PARENT_STORAGE_STATE });

  test("child signs in with family code + PIN and sees today's view and the adventure map", async ({
    browser,
    page,
  }) => {
    // Read the family code from the parent UI, then sign in as a child in a fresh context.
    await page.goto("/parent/children");
    const header = await page.getByText(/Family code for child sign-in:/).textContent();
    const familyCode = header?.split(":").pop()?.trim();
    expect(familyCode).toBeTruthy();

    const childContext = await browser.newContext(ANONYMOUS);
    const child = await childContext.newPage();
    await child.goto("/child/sign-in");
    await child.getByLabel("Family code").fill(familyCode!);
    await child.getByRole("button", { name: "Find my crew" }).click();
    await expect(child.getByTestId("child-signin-step-pin")).toBeVisible();
    await child.getByLabel("Ava").check();
    await child.getByLabel("Secret PIN").fill("1234");
    await child.getByRole("button", { name: "Set sail!" }).click();
    await child.waitForURL("**/child");

    await expect(child.getByTestId("child-shell")).toBeVisible();
    await expect(child.getByTestId("child-name")).toContainText("Ava");
    await expect(child.getByTestId("child-nav")).toBeVisible();
    await expect(child.getByTestId("today-chores")).toBeVisible();

    await child.getByRole("link", { name: /Adventure/ }).click();
    await expect(child).toHaveURL(/\/child\/adventure$/);
    await expect(child.getByTestId("adventure-map")).toBeVisible();
    const markers = child.getByTestId("map-marker");
    await expect(markers).toHaveCount(6);
    await expect(child.locator('[data-testid="map-marker"][data-state="locked"]')).toHaveCount(5);
    await expect(child.locator('[data-testid="map-marker"][data-state="current"]')).toHaveCount(1);

    // A child session must not open the parent area.
    await child.goto("/parent");
    await expect(child).toHaveURL(/\/sign-in/);
    await childContext.close();
  });

  test("wrong PIN is rejected", async ({ page, browser }) => {
    await page.goto("/parent/children");
    const familyCode = (await page.getByText(/Family code for child sign-in:/).textContent())
      ?.split(":")
      .pop()
      ?.trim();
    const ctx = await browser.newContext(ANONYMOUS);
    const child = await ctx.newPage();
    await child.goto("/child/sign-in");
    await child.getByLabel("Family code").fill(familyCode!);
    await child.getByRole("button", { name: "Find my crew" }).click();
    await child.getByLabel("Max").check();
    await child.getByLabel("Secret PIN").fill("0000");
    await child.getByRole("button", { name: "Set sail!" }).click();
    await expect(child.getByRole("alert")).toBeVisible();
    await expect(child).toHaveURL(/\/child\/sign-in$/);
    await ctx.close();
  });
});

test.describe("device hand-over", () => {
  // Uses its own sign-in: hand-over revokes the session it runs with, which must not be the shared one.
  test("handing the device to a child signs the parent out", async ({ page }) => {
    await signInAsParent(page);
    await page.goto("/parent/children");
    await page.getByRole("button", { name: /Hand device to Ava/ }).click();
    await page.waitForURL("**/child");
    await expect(page.getByTestId("child-name")).toContainText("Ava");
    // The child must not be able to reach the parent area on this device.
    await page.goto("/parent/approvals");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
