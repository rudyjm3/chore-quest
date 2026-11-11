import { test as setup } from "@playwright/test";

import { PARENT_STORAGE_STATE, signInAsParent } from "./fixtures";

/** Signs the demo parent in once and saves the session for the parent and child flow tests. */
setup("sign in as the demo parent", async ({ page }) => {
  await signInAsParent(page);
  await page.context().storageState({ path: PARENT_STORAGE_STATE });
});
