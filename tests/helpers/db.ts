import "dotenv/config";

import { createPrismaClient } from "@/lib/db/prisma";
import type { PrismaClient } from "@/generated/prisma/client";

let client: PrismaClient | undefined;

/** Prisma client bound to TEST_DATABASE_URL. */
export function testDb(): PrismaClient {
  if (!client) {
    const url = process.env.TEST_DATABASE_URL;
    if (!url) throw new Error("TEST_DATABASE_URL is not set");
    client = createPrismaClient(url);
  }
  return client;
}

/** Remove all household data between tests while keeping seeded reference data. */
export async function resetHouseholdData(db: PrismaClient = testDb()) {
  // Family cascades to every household-scoped table; users cascade sessions/accounts.
  await db.family.deleteMany();
  await db.user.deleteMany();
}

export async function disconnectTestDb() {
  await client?.$disconnect();
  client = undefined;
}
