import type { DbClient } from "@/lib/db/prisma";
import { log } from "@/lib/logging";

import type { EmailMessage, EmailSender } from "./types";

/**
 * Development/test driver: nothing leaves the machine. Each message is stored in `email_outbox`
 * (so tests and local developers can open the link) and only the message kind is logged: the
 * address and the link are secrets/PII and must never reach the logs.
 */
export function createDevEmailSender(db: DbClient): EmailSender {
  return {
    async send(message: EmailMessage) {
      await db.emailOutbox.create({
        data: {
          kind: message.kind,
          toAddress: message.to.toLowerCase(),
          subject: message.subject,
          textBody: message.text,
        },
      });
      log.info("email.captured", { kind: message.kind });
    },
  };
}

/** Latest captured message for an address (tests and the dev outbox page). */
export async function latestOutboxMessage(db: DbClient, to: string, kind?: EmailMessage["kind"]) {
  return db.emailOutbox.findFirst({
    where: { toAddress: to.toLowerCase(), ...(kind ? { kind } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

/** First http(s) URL in a message body, or null. */
export function extractLink(text: string): string | null {
  return /https?:\/\/[^\s]+/.exec(text)?.[0] ?? null;
}

/** Delete captured mail older than `days` (called by the maintenance job). */
export async function pruneOutbox(db: DbClient, days = 7, now = new Date()) {
  const result = await db.emailOutbox.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - days * 86_400_000) } },
  });
  return result.count;
}
