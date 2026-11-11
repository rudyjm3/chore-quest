import { z } from "zod";

import { longTextSchema, pointsSchema, shortTextSchema, uuidSchema } from "./common";
import { approvalPolicySchema, scheduleSchema } from "./tasks";

export const createRoutineSchema = z.object({
  familyId: uuidSchema,
  name: shortTextSchema,
  description: longTextSchema.optional(),
  iconKey: z.string().max(64).optional(),
  /** Ordered task ids from the family's task library. */
  taskIds: z.array(uuidSchema).min(1).max(30),
  templateKey: z.string().max(64).optional(),
});
export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;

export const assignRoutineSchema = z.object({
  familyId: uuidSchema,
  routineId: uuidSchema,
  childId: uuidSchema,
  schedule: scheduleSchema,
  bonusPoints: pointsSchema.default(0),
  approvalPolicy: approvalPolicySchema.default("PARENT_REVIEW"),
});
export type AssignRoutineInput = z.infer<typeof assignRoutineSchema>;

export const completeRoutineStepSchema = z.object({
  runId: uuidSchema,
  stepId: uuidSchema,
});
