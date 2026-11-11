import { execSync } from "node:child_process";

import "dotenv/config";

import { seedReferenceData } from "../../prisma/seed";

/**
 * Prepares the integration test database:
 *   1. Applies committed migrations with `prisma migrate deploy` (never `db push`).
 *   2. Seeds reference data (presets, pirate adventure).
 * Requires TEST_DATABASE_URL. Refuses to touch DATABASE_URL.
 */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL must be set to run integration tests");
  if (url === process.env.DATABASE_URL) {
    throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL (tests reset the database)");
  }
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
  await seedReferenceData(url);
}
