import { z } from "zod";

import { longTextSchema, pointsSchema, shortTextSchema, uuidSchema } from "./common";

export const createRewardDefinitionSchema = z.object({
  familyId: uuidSchema,
  title: shortTextSchema,
  description: longTextSchema.optional(),
  costPoints: pointsSchema,
  iconKey: z.string().max(64).optional(),
});

export const requestRedemptionSchema = z.object({
  rewardDefinitionId: uuidSchema,
});

export const resolveRedemptionSchema = z.object({
  familyId: uuidSchema,
  redemptionId: uuidSchema,
  decision: z.enum(["APPROVED", "DENIED", "FULFILLED"]),
});

export const parentAdjustmentSchema = z.object({
  familyId: uuidSchema,
  childId: uuidSchema,
  currency: z.enum(["POINTS", "COINS", "XP"]),
  amount: z
    .number()
    .int()
    .min(-10_000)
    .max(10_000)
    .refine((n) => n !== 0, "Amount cannot be zero"),
  reason: z.string().trim().min(1).max(200),
  /** Client-generated idempotency key so a double-submit cannot double-adjust. */
  idempotencyKey: z.string().trim().min(8).max(128),
});
export type ParentAdjustmentInput = z.infer<typeof parentAdjustmentSchema>;
