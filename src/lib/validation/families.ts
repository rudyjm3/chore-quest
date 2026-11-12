import { z } from "zod";

import { AVATAR_KEYS } from "@/lib/avatars";

import { dayOfWeekSchema, shortTextSchema, timeZoneSchema, uuidSchema } from "./common";

export const createFamilySchema = z.object({
  name: shortTextSchema,
  timezone: timeZoneSchema,
  weekStartsOn: dayOfWeekSchema.default(1),
});
export type CreateFamilyInput = z.infer<typeof createFamilySchema>;

export const updateFamilySettingsSchema = z.object({
  familyId: uuidSchema,
  name: shortTextSchema.optional(),
  timezone: timeZoneSchema.optional(),
  weekStartsOn: dayOfWeekSchema.optional(),
  defaultApprovalPolicy: z.enum(["PARENT_REVIEW", "AUTO_APPROVE"]).optional(),
  allowChildSelfSignIn: z.boolean().optional(),
});
export type UpdateFamilySettingsInput = z.infer<typeof updateFamilySettingsSchema>;

/** A PIN is 4–6 digits. Children never use passwords or email addresses. */
export const childPinSchema = z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits");

export const createChildSchema = z.object({
  familyId: uuidSchema,
  displayName: shortTextSchema,
  avatarKey: z.enum(AVATAR_KEYS).optional(),
  birthYear: z
    .number()
    .int()
    .min(new Date().getUTCFullYear() - 18)
    .max(new Date().getUTCFullYear())
    .optional(),
  pin: childPinSchema.optional(),
});
export type CreateChildInput = z.infer<typeof createChildSchema>;

export const setChildPinSchema = z
  .object({
    familyId: uuidSchema,
    childId: uuidSchema,
    pin: childPinSchema,
    confirmPin: z.string().optional(),
  })
  .refine((v) => v.confirmPin === undefined || v.confirmPin === v.pin, {
    path: ["confirmPin"],
    message: "PINs do not match",
  });

export const updateChildProfileSchema = z.object({
  familyId: uuidSchema,
  childId: uuidSchema,
  displayName: shortTextSchema,
  avatarKey: z.enum(AVATAR_KEYS).nullable(),
});
export type UpdateChildProfileInput = z.infer<typeof updateChildProfileSchema>;

export const childIdSchema = z.object({ familyId: uuidSchema, childId: uuidSchema });

export const childSignInSchema = z.object({
  familyCode: z.string().trim().toUpperCase().min(4).max(12),
  childId: uuidSchema,
  pin: childPinSchema,
});
export type ChildSignInInput = z.infer<typeof childSignInSchema>;

export const familyCodeLookupSchema = z.object({
  familyCode: z.string().trim().toUpperCase().min(4).max(12),
});
