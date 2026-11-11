import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end smoke tests. The web server is started from the production build
 * against DATABASE_URL, which must already be migrated and seeded with the
 * demo family (`pnpm db:migrate:deploy && pnpm db:seed:dev`).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "off",
    screenshot: "only-on-failure",
    // Optional: point at a pre-installed Chromium (e.g. in sandboxes) instead of the Playwright download.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    { name: "mobile", use: { ...devices["Pixel 7"] }, dependencies: ["setup"] },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm exec next start -p 3100",
        url: baseURL,
        // Better Auth validates request origins against BETTER_AUTH_URL.
        env: { BETTER_AUTH_URL: baseURL, NEXT_PUBLIC_APP_URL: baseURL },
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
