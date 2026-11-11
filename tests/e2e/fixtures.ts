import { expect, type Page } from "@playwright/test";

/** Demo parent created by `pnpm db:seed:dev`. */
export const DEMO_PARENT = { email: "demo.parent@chorequests.local", password: "DemoPassword123!" };

/**
 * Saved parent session written by `auth.setup.ts`. Reusing it keeps the suite well under Better
 * Auth's sign-in rate limit (10 per minute), which is a deliberate production setting.
 */
export const PARENT_STORAGE_STATE = "playwright/.auth/parent.json";

export async function signInAsParent(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(DEMO_PARENT.email);
  await page.getByLabel("Password").fill(DEMO_PARENT.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/parent");
  await expect(page.getByTestId("parent-shell")).toBeVisible();
}
