import { z } from "zod";

import {
  longTextSchema,
  pointsSchema,
  shortTextSchema,
  timeOfDaySchema,
  uuidSchema,
} from "./common";
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

const windowFields = {
  windowStart: timeOfDaySchema.optional(),
  windowEnd: timeOfDaySchema.optional(),
};

/** A completion window needs both bounds or neither. */
function windowRefine(value: { windowStart?: string; windowEnd?: string }, ctx: z.RefinementCtx) {
  if (Boolean(value.windowStart) !== Boolean(value.windowEnd)) {
    ctx.addIssue({
      code: "custom",
      path: ["windowEnd"],
      message: "Set both the start and end of the window, or neither",
    });
  }
}

export const assignRoutineSchema = z
  .object({
    familyId: uuidSchema,
    routineId: uuidSchema,
    childId: uuidSchema,
    schedule: scheduleSchema,
    bonusPoints: pointsSchema.default(0),
    approvalPolicy: approvalPolicySchema.default("PARENT_REVIEW"),
    ...windowFields,
  })
  .superRefine(windowRefine);
export type AssignRoutineInput = z.infer<typeof assignRoutineSchema>;

export const updateRoutineAssignmentSchema = z
  .object({
    familyId: uuidSchema,
    assignmentId: uuidSchema,
    schedule: scheduleSchema,
    bonusPoints: pointsSchema.default(0),
    approvalPolicy: approvalPolicySchema.default("PARENT_REVIEW"),
    ...windowFields,
  })
  .superRefine(windowRefine);
export type UpdateRoutineAssignmentInput = z.infer<typeof updateRoutineAssignmentSchema>;

export const updateRoutineSchema = z.object({
  familyId: uuidSchema,
  routineId: uuidSchema,
  name: shortTextSchema,
  description: longTextSchema.optional(),
});
export type UpdateRoutineInput = z.infer<typeof updateRoutineSchema>;

export const moveRoutineStepSchema = z.object({
  familyId: uuidSchema,
  routineId: uuidSchema,
  stepId: uuidSchema,
  direction: z.enum(["up", "down"]),
});

export const setStepOptionalSchema = z.object({
  familyId: uuidSchema,
  routineId: uuidSchema,
  stepId: uuidSchema,
  isOptional: z.boolean(),
});

export const archiveRoutineSchema = z.object({
  familyId: uuidSchema,
  routineId: uuidSchema,
  archived: z.boolean(),
});

export const routineAssignmentStatusSchema = z.object({
  familyId: uuidSchema,
  assignmentId: uuidSchema,
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]),
});

export const completeRoutineStepSchema = z.object({
  runId: uuidSchema,
  stepId: uuidSchema,
});
