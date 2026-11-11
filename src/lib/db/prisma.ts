import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient, type Prisma } from "@/generated/prisma/client";

/**
 * Application Prisma client (Prisma 7 + pg driver adapter).
 *
 * - A single instance is cached on `globalThis` in development so Next.js hot
 *   reloads do not exhaust the connection pool.
 * - Tests create their own client against TEST_DATABASE_URL via
 *   `createPrismaClient` so they never touch the dev database.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG === "query" ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
  }
  return url;
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient(resolveConnectionString());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Transaction client type used by services that accept an optional transaction. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/** Serialize all mutations for one child inside a transaction (row lock). */
export async function lockChildRow(tx: Prisma.TransactionClient, childId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "child" WHERE id = ${childId}::uuid FOR UPDATE`;
}
