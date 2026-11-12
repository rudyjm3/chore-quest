import "dotenv/config";

import { createPrismaClient } from "@/lib/db/prisma";

/**
 * E2E tests read links from the development email driver's outbox table (the app under test uses
 * the same DATABASE_URL), exactly as a developer would in /dev/outbox.
 */
const db = createPrismaClient(process.env.DATABASE_URL ?? "");

export async function waitForMailLink(
  to: string,
  kind: "verify-email" | "reset-password" | "guardian-invite",
  timeoutMs = 15_000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const mail = await db.emailOutbox.findFirst({
      where: { toAddress: to.toLowerCase(), kind },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const link = mail ? /https?:\/\/\S+/.exec(mail.textBody)?.[0] : null;
    if (link) return link;
    if (Date.now() > deadline) throw new Error(`No ${kind} mail captured for ${to}`);
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

export async function closeOutbox() {
  await db.$disconnect();
}
