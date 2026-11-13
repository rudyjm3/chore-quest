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

/** Child sign-in on a fresh device (no cookies). Reads the family code from the parent UI. */
export async function signInAsChild(
  parentPage: Page,
  childPage: Page,
  childName: "Ava" | "Max",
  pin: string,
) {
  await parentPage.goto("/parent/children");
  const header = await parentPage.getByText(/Family code for child sign-in:/).textContent();
  const familyCode = header?.split(":").pop()?.trim();
  await childPage.goto("/child/sign-in");
  await childPage.getByLabel("Family code").fill(familyCode!);
  await childPage.getByRole("button", { name: "Find my crew" }).click();
  await childPage.getByLabel(childName).check();
  await childPage.getByLabel("Secret PIN").fill(pin);
  await childPage.getByRole("button", { name: "Set sail!" }).click();
  await childPage.waitForURL("**/child");
}
