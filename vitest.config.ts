import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Unit tests: pure functions only, no database. */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    name: "unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    env: { NODE_ENV: "test" },
  },
});
