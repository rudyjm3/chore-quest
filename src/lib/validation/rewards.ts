import { z } from "zod";

import { longTextSchema, pointsSchema, shortTextSchema, uuidSchema } from "./common";

const rewardFields = {
  title: shortTextSchema,
  description: longTextSchema.optional(),
  costPoints: pointsSchema.min(1, "A reward must cost at least 1 point"),
  iconKey: z.string().max(64).optional(),
  /** Leave empty for unlimited. */
  stock: z.number().int().min(0).max(10_000).optional(),
};

export const createRewardDefinitionSchema = z.object({ familyId: uuidSchema, ...rewardFields });
export type CreateRewardInput = z.infer<typeof createRewardDefinitionSchema>;

export const updateRewardDefinitionSchema = z.object({
  familyId: uuidSchema,
  rewardId: uuidSchema,
  ...rewardFields,
});
export type UpdateRewardInput = z.infer<typeof updateRewardDefinitionSchema>;

export const setRewardActiveSchema = z.object({
  familyId: uuidSchema,
  rewardId: uuidSchema,
  active: z.boolean(),
});

export const requestRedemptionSchema = z.object({
  rewardDefinitionId: uuidSchema,
});

export const resolveRedemptionSchema = z.object({
  familyId: uuidSchema,
  redemptionId: uuidSchema,
  decision: z.enum(["APPROVED", "DENIED", "FULFILLED"]),
  note: z.string().trim().max(300).optional(),
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
