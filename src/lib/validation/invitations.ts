import { z } from "zod";

import { uuidSchema } from "./common";

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
});

/** URL-safe base64 tokens only: 32 random bytes encode to 43 characters. */
export const invitationTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{20,128}$/, "Invalid invitation link");

export const revokeInvitationSchema = z.object({ invitationId: uuidSchema });
export const removeGuardianSchema = z.object({ memberId: uuidSchema });
