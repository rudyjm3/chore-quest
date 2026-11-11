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
