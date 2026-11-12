import { expect, test } from "@playwright/test";

import { PARENT_STORAGE_STATE } from "./fixtures";
import { closeOutbox, waitForMailLink } from "./outbox";

const ANONYMOUS = { storageState: { cookies: [], origins: [] } };
const stamp = Date.now();
const NEW_PARENT = {
  name: "E2E Guardian",
  email: `e2e.guardian.${stamp}@example.test`,
  password: "FirstPassword123!",
};

test.afterAll(closeOutbox);

// Auth endpoints are rate limited per IP on purpose; run these once (desktop project only).
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "auth flows run once, on desktop");
});

test.describe("email verification, password reset and guardian invitations", () => {
  test.use(ANONYMOUS);

  test("sign-up needs email confirmation; the emailed link signs the parent in", async ({
    page,
  }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Your name").fill(NEW_PARENT.name);
    await page.getByLabel("Email").fill(NEW_PARENT.email);
    await page.getByLabel(/^Password/).fill(NEW_PARENT.password);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByTestId("check-email")).toBeVisible({ timeout: 15_000 });

    // No session yet: the parent area stays closed.
    await page.goto("/parent/onboarding");
    await expect(page).toHaveURL(/\/sign-in/);

    const link = await waitForMailLink(NEW_PARENT.email, "verify-email");
    await page.goto(link);
    await page.waitForURL("**/parent/onboarding");
    await expect(page.getByRole("heading", { name: /Welcome, E2E Guardian/ })).toBeVisible();
  });

  test("forgot password: emailed link sets a new password and old one stops working", async ({
    page,
  }) => {
    const newPassword = "SecondPassword456!";
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill(NEW_PARENT.email);
    await page.getByRole("button", { name: "Send reset link" }).click();
    await expect(page.getByTestId("reset-sent")).toBeVisible({ timeout: 15_000 });

    const link = await waitForMailLink(NEW_PARENT.email, "reset-password");
    await page.goto(link);
    await page.waitForURL("**/reset-password?token=*");
    await page.getByLabel("New password (10+ characters)").fill(newPassword);
    await page.getByLabel("Confirm new password").fill(newPassword);
    await page.getByRole("button", { name: "Change password" }).click();
    await page.waitForURL("**/sign-in");

    await page.getByLabel("Email").fill(NEW_PARENT.email);
    await page.getByLabel("Password").fill(NEW_PARENT.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("[data-sonner-toast]").first()).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(/\/sign-in/);

    await page.getByLabel("Password").fill(newPassword);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("**/parent/onboarding");
    NEW_PARENT.password = newPassword;
  });

  test("an invalid reset link is explained, not accepted", async ({ page }) => {
    await page.goto("/reset-password?error=INVALID_TOKEN");
    await expect(page.locator("p[role=alert]")).toContainText(/invalid or has expired/i);
  });

  test("owner invites a guardian; the invitee accepts once and sees the family", async ({
    browser,
  }) => {
    const owner = await browser.newContext({ storageState: PARENT_STORAGE_STATE });
    const ownerPage = await owner.newPage();
    await ownerPage.goto("/parent/settings");
    await ownerPage.getByLabel("Email address").fill(NEW_PARENT.email);
    await ownerPage.getByRole("button", { name: "Send invitation" }).click();
    const shown = await ownerPage.getByTestId("invite-link").textContent();
    expect(shown).toContain("/invite/");
    await expect(ownerPage.getByTestId("pending-invitations")).toContainText(NEW_PARENT.email);

    const link = await waitForMailLink(NEW_PARENT.email, "guardian-invite");
    expect(link).toBe(shown);

    // The invitee signs in with the invited address and accepts.
    const guest = await browser.newContext(ANONYMOUS);
    const guestPage = await guest.newPage();
    // The link origin is baked in at build time; follow its path on the server under test.
    const invitePath = new URL(link).pathname;
    await guestPage.goto(invitePath);
    await expect(guestPage.getByTestId("invite-page")).toContainText("The Demo Crew");
    await guestPage.getByRole("link", { name: "Sign in to accept" }).click();
    await guestPage.getByLabel("Email").fill(NEW_PARENT.email);
    await guestPage.getByLabel("Password").fill(NEW_PARENT.password);
    await guestPage.getByRole("button", { name: "Sign in" }).click();
    await guestPage.waitForURL(/\/invite\//);
    await guestPage.getByRole("button", { name: "Accept invitation" }).click();
    await guestPage.waitForURL("**/parent");
    await expect(guestPage.locator('[data-testid="family-name"]:visible')).toContainText(
      "The Demo Crew",
    );

    // Single use: the same link is now dead.
    await guestPage.goto(invitePath);
    await expect(guestPage.getByTestId("invite-invalid")).toBeVisible();

    // Owner removes the guardian again so the demo family stays tidy.
    await ownerPage.goto("/parent/settings");
    await ownerPage.getByRole("button", { name: /^Remove E2E Guardian/ }).click();
    await expect(ownerPage.getByText(NEW_PARENT.email)).toHaveCount(0);
    await guestPage.goto("/parent");
    await expect(guestPage).toHaveURL(/\/parent\/onboarding/);

    await owner.close();
    await guest.close();
  });
});
