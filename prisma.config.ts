import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 configuration.
 *
 * - The datasource URL lives here (not in schema.prisma) so the same schema can
 *   be pointed at the dev, test, or CI database by changing DATABASE_URL only.
 * - `migrations.seed` is what `pnpm prisma db seed` runs. The seed is idempotent
 *   and only writes global reference data (presets, adventure definitions).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // `process.env` (not `env()`) so `prisma generate` works without a database.
    url: process.env.DATABASE_URL ?? "",
  },
});
