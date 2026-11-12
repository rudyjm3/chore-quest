import { prisma } from "@/lib/db/prisma";
import { log } from "@/lib/logging";

import { createDevEmailSender } from "./dev-driver";
import type { EmailSender } from "./types";

export type { EmailKind, EmailMessage, EmailSender } from "./types";

let cached: EmailSender | undefined;
let warned = false;

/**
 * The configured sender (`EMAIL_DRIVER`, default "dev"). Add providers by extending the switch;
 * an unknown driver fails fast instead of silently dropping mail.
 */
export function getEmailSender(): EmailSender {
  if (cached) return cached;
  const driver = process.env.EMAIL_DRIVER ?? "dev";
  switch (driver) {
    case "dev":
      if (process.env.NODE_ENV === "production" && !warned) {
        warned = true;
        log.warn("email.dev_driver_in_production", {
          note: "Mail is stored in email_outbox and NOT delivered. Configure a real provider.",
        });
      }
      cached = createDevEmailSender(prisma);
      return cached;
    default:
      throw new Error(`Unknown EMAIL_DRIVER "${driver}". Supported: dev.`);
  }
}
