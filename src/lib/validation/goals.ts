import { z } from "zod";

import {
  localDateSchema,
  longTextSchema,
  pointsSchema,
  shortTextSchema,
  uuidSchema,
} from "./common";
import { taskCategorySchema } from "./tasks";

export const goalTypeSchema = z.enum([
  "TOTAL_COUNT",
  "WEEKLY_COUNT",
  "CONSECUTIVE_DAYS",
  "ROUTINE_CONSISTENCY",
  "CUSTOM_MILESTONE",
]);

export const createGoalSchema = z
  .object({
    familyId: uuidSchema,
    title: shortTextSchema,
    description: longTextSchema.optional(),
    type: goalTypeSchema,
    targetCount: z.number().int().min(1).max(10_000),
    recurrence: z.enum(["NONE", "WEEKLY"]).default("NONE"),
    filterTaskId: uuidSchema.optional(),
    filterRoutineId: uuidSchema.optional(),
    filterCategory: taskCategorySchema.optional(),
    rewardPoints: pointsSchema.default(0),
    rewardDescription: z.string().trim().max(200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.recurrence === "WEEKLY" && value.type !== "WEEKLY_COUNT") {
      ctx.addIssue({
        code: "custom",
        path: ["recurrence"],
        message: "Only weekly goals can recur weekly",
      });
    }
    if (value.type === "ROUTINE_CONSISTENCY" && !value.filterRoutineId) {
      ctx.addIssue({
        code: "custom",
        path: ["filterRoutineId"],
        message: "Routine goals need a routine",
      });
    }
  });
export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const assignGoalSchema = z.object({
  familyId: uuidSchema,
  goalId: uuidSchema,
  childIds: z.array(uuidSchema).min(1).max(20),
  startDate: localDateSchema,
  endDate: localDateSchema.optional(),
});
export type AssignGoalInput = z.infer<typeof assignGoalSchema>;

export const updateGoalSchema = z.object({
  familyId: uuidSchema,
  goalId: uuidSchema,
  title: shortTextSchema,
  description: longTextSchema.optional(),
  targetCount: z.number().int().min(1).max(10_000),
  rewardPoints: pointsSchema.default(0),
  rewardDescription: z.string().trim().max(200).optional(),
});
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const setGoalArchivedSchema = z.object({
  familyId: uuidSchema,
  goalId: uuidSchema,
  archived: z.boolean(),
});

export const updateGoalAssignmentSchema = z.object({
  familyId: uuidSchema,
  assignmentId: uuidSchema,
  startDate: localDateSchema.optional(),
  endDate: localDateSchema.nullable().optional(),
  /** Per-assignment target; null clears the override. */
  targetCount: z.number().int().min(1).max(10_000).nullable().optional(),
  /** Household-local "today", used to decide whether an expired assignment is live again. */
  today: localDateSchema,
});
export type UpdateGoalAssignmentInput = z.infer<typeof updateGoalAssignmentSchema>;
