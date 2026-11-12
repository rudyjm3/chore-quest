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

test.describe("family management pages", () => {
  test.use({ storageState: PARENT_STORAGE_STATE });

  test("task library: preset browser is grouped by category and adds a preset", async ({
    page,
  }) => {
    await page.goto("/parent/tasks");
    const browser = page.getByTestId("preset-browser");
    await expect(browser).toBeVisible();
    const groups = browser.locator("details");
    expect(await groups.count()).toBeGreaterThan(1);
    await groups.first().locator("summary").click();
    await groups
      .first()
      .getByRole("button", { name: /^Add .* to library$/ })
      .first()
      .click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText(
      "Added to your library",
    );
  });

  test("task library: edit a task and archive then restore it", async ({ page }) => {
    await page.goto("/parent/tasks");
    const unique = `E2E task ${Date.now()}`;
    await page.getByLabel("Title").first().fill(unique);
    await page.getByRole("button", { name: "Create task" }).click();
    const card = page.getByTestId("task-list").locator("li", { hasText: unique });
    await expect(card).toBeVisible();
    await card.getByText("Edit", { exact: true }).click();
    await card.getByLabel("Points").fill("12");
    await card.getByRole("button", { name: "Save task" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Task updated");
    await page.reload();
    await expect(page.getByTestId("task-list").locator("li", { hasText: unique })).toContainText(
      "12 pts",
    );
    await page
      .getByTestId("task-list")
      .locator("li", { hasText: unique })
      .getByRole("button", { name: "Archive" })
      .click();
    const archived = page.getByTestId("archived-tasks").locator("li", { hasText: unique });
    await expect(archived).toBeVisible();
    await archived.getByRole("button", { name: "Restore" }).click();
    await expect(page.getByTestId("task-list").locator("li", { hasText: unique })).toBeVisible();
  });

  test("children: pick an avatar, archive and restore a child", async ({ page }) => {
    await page.goto("/parent/children");
    const name = `Temp${Date.now() % 100000}`;
    await page.getByLabel("Name or nickname").first().fill(name);
    await page.getByLabel("Fox").first().check({ force: true });
    await page.getByRole("button", { name: "Add child" }).click();
    const card = page.getByTestId("children-list").locator("> div", { hasText: name });
    await expect(card).toContainText("🦊");
    await card.getByText("Edit profile").click();
    await card.getByLabel("Owl").check({ force: true });
    await card.getByRole("button", { name: "Save profile" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toContainText("Profile saved");
    await page.reload();
    await expect(
      page.getByTestId("children-list").locator("> div", { hasText: name }),
    ).toContainText("🦉");
    await page.getByRole("button", { name: `Archive ${name}` }).click();
    const archived = page.getByTestId("archived-children").locator("li", { hasText: name });
    await expect(archived).toBeVisible();
    await archived.getByRole("button", { name: `Restore ${name}` }).click();
    await expect(page.getByTestId("children-list")).toContainText(name);
    await page.getByRole("button", { name: `Archive ${name}` }).click();
    await expect(page.getByTestId("archived-children")).toContainText(name);
  });

  test("routines: steps can be reordered", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/parent/routines");
    const steps = page.getByTestId("routine-steps").first();
    const firstTitle = (await steps.locator("li").first().textContent())
      ?.match(/^1\. (.+?)(?:\(optional\))?[↑↓]/)?.[1]
      ?.trim();
    expect(firstTitle).toBeTruthy();
    await steps.getByRole("button", { name: `Move ${firstTitle} down` }).click();
    await expect(steps.locator("li").nth(1)).toContainText(firstTitle!);
    // Put it back so reruns are stable.
    await steps.getByRole("button", { name: `Move ${firstTitle} up` }).click();
    await expect(steps.locator("li").first()).toContainText(firstTitle!);
  });

  test("history page renders, filters, and rejects a backwards range", async ({ page }) => {
    await page.goto("/parent/history");
    await expect(page.getByRole("heading", { name: "Activity history" })).toBeVisible();
    await page.goto("/parent/history?from=2026-12-31&to=2026-01-01");
    await expect(page.locator("p[role=alert]")).toContainText("start date");
    await page.goto("/parent/history?cursor=garbage&child=not-a-uuid&from=nonsense");
    await expect(page.getByRole("heading", { name: "Activity history" })).toBeVisible();
  });

  test("settings: owner can rotate the family code", async ({ page }) => {
    await page.goto("/parent/settings");
    await expect(page.getByRole("button", { name: "Create a new family code" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Invite another adult" })).toBeVisible();
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

    await child.getByRole("link", { name: /History/ }).click();
    await expect(child).toHaveURL(/\/child\/history$/);
    await expect(child.getByRole("heading", { name: "My history" })).toBeVisible();
    await child.getByRole("link", { name: /Today/ }).click();

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
