import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Integration tests: run against TEST_DATABASE_URL (a disposable PostgreSQL
 * database). The global setup applies migrations and reseeds reference data.
 * Files run serially because they share one database.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: { NODE_ENV: "test" },
  },
});
