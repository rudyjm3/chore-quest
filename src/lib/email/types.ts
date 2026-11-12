/**
 * Outgoing email abstraction. Application code depends only on `EmailSender`, never on a vendor.
 * To add a real provider (Resend, Postmark, SES, SMTP…) implement this interface in a new file,
 * register it in `./index.ts` under a new `EMAIL_DRIVER` value and add its secrets to
 * `src/lib/env.ts`. See docs/development/EMAIL.md.
 */
export type EmailKind = "verify-email" | "reset-password" | "guardian-invite";

export interface EmailMessage {
  kind: EmailKind;
  to: string;
  subject: string;
  /** Plain-text body. Contains the action link; never log it. */
  text: string;
}

export interface EmailSender {
  /** Resolve once the message is accepted for delivery; throw if it was not. */
  send(message: EmailMessage): Promise<void>;
}
