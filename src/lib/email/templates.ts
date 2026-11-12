import type { EmailMessage } from "./types";

/** Pure message builders. Keep copy short, plain text, and free of child data. */

export function verifyEmailMessage(to: string, url: string): EmailMessage {
  return {
    kind: "verify-email",
    to,
    subject: "Confirm your email for Chore Quests",
    text: [
      "Welcome to Chore Quests!",
      "",
      "Confirm your email address to finish creating your account:",
      url,
      "",
      "If you didn't create an account, you can ignore this email.",
    ].join("\n"),
  };
}

export function resetPasswordMessage(to: string, url: string): EmailMessage {
  return {
    kind: "reset-password",
    to,
    subject: "Reset your Chore Quests password",
    text: [
      "We received a request to reset your Chore Quests password.",
      "",
      "Choose a new password here (the link expires in one hour):",
      url,
      "",
      "If you didn't ask for this, you can ignore this email; your password stays the same.",
    ].join("\n"),
  };
}

export function guardianInviteMessage(params: {
  to: string;
  familyName: string;
  inviterName: string;
  url: string;
  expiresAt: Date;
}): EmailMessage {
  return {
    kind: "guardian-invite",
    to: params.to,
    subject: `${params.inviterName} invited you to join ${params.familyName} on Chore Quests`,
    text: [
      `${params.inviterName} invited you to help manage the ${params.familyName} household on Chore Quests.`,
      "",
      "Accept the invitation (sign in or create an account with this email address):",
      params.url,
      "",
      `This invitation can be used once and expires on ${params.expiresAt.toISOString().slice(0, 10)}.`,
      "If you weren't expecting it, you can ignore this email.",
    ].join("\n"),
  };
}
