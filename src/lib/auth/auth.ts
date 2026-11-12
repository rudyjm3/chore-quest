import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

import { prisma } from "@/lib/db/prisma";
import { getEmailSender } from "@/lib/email";
import { resetPasswordMessage, verifyEmailMessage } from "@/lib/email/templates";

/**
 * Better Auth server instance (parents/guardians only).
 *
 * Children never get a Better Auth account: they use family-managed child
 * sessions (see src/lib/auth/child-session.ts). Keeping the two systems apart
 * means a parent session never implicitly authorizes child-only actions and
 * vice versa.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    // Parents must prove they own the address before signing in (opt-out only for deployments
    // with no email provider yet: see docs/development/EMAIL.md).
    requireEmailVerification: process.env.REQUIRE_EMAIL_VERIFICATION !== "false",
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    // Delivery goes through the EmailSender abstraction. The URL is a secret: never log it.
    sendResetPassword: async ({ user, url }) => {
      await getEmailSender().send(resetPasswordMessage(user.email, url));
    },
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 24 hours
    sendVerificationEmail: async ({ user, url }) => {
      await getEmailSender().send(verifyEmailMessage(user.email, url));
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14, // 14 days
    updateAge: 60 * 60 * 24, // refresh at most once a day
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 5 },
    },
  },
  advanced: {
    database: { generateId: "uuid" },
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
