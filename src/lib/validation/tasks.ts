import { z } from "zod";

import {
  dayOfWeekSchema,
  localDateSchema,
  longTextSchema,
  pointsSchema,
  shortTextSchema,
  timeOfDaySchema,
  uuidSchema,
} from "./common";

export const taskCategorySchema = z.enum([
  "CHORE",
  "HYGIENE",
  "SCHOOL",
  "PET_CARE",
  "HELPING",
  "OTHER",
]);
export const approvalPolicySchema = z.enum(["PARENT_REVIEW", "AUTO_APPROVE"]);
export const recurrenceFrequencySchema = z.enum(["ONCE", "DAILY", "WEEKLY", "SPECIFIC_DAYS"]);

export const createTaskSchema = z.object({
  familyId: uuidSchema,
  presetKey: z.string().max(64).optional(),
  title: shortTextSchema,
  description: longTextSchema.optional(),
  category: taskCategorySchema.default("CHORE"),
  iconKey: z.string().max(64).optional(),
  points: pointsSchema.default(5),
  approvalPolicy: approvalPolicySchema.default("PARENT_REVIEW"),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = createTaskSchema
  .omit({ familyId: true, presetKey: true })
  .partial()
  .extend({ familyId: uuidSchema, taskId: uuidSchema, isArchived: z.boolean().optional() });
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const scheduleSchema = z
  .object({
    frequency: recurrenceFrequencySchema,
    daysOfWeek: z.array(dayOfWeekSchema).max(7).default([]),
    startDate: localDateSchema,
    endDate: localDateSchema.optional(),
    dueTime: timeOfDaySchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endDate && value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be on or after start date",
      });
    }
    if (value.frequency === "SPECIFIC_DAYS" && value.daysOfWeek.length === 0) {
      ctx.addIssue({ code: "custom", path: ["daysOfWeek"], message: "Pick at least one day" });
    }
    if (value.frequency === "WEEKLY" && value.daysOfWeek.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["daysOfWeek"],
        message: "Weekly tasks need exactly one day",
      });
    }
    if (new Set(value.daysOfWeek).size !== value.daysOfWeek.length) {
      ctx.addIssue({ code: "custom", path: ["daysOfWeek"], message: "Days must be unique" });
    }
  });
export type ScheduleInput = z.infer<typeof scheduleSchema>;

export const assignTaskSchema = z.object({
  familyId: uuidSchema,
  taskId: uuidSchema,
  childIds: z.array(uuidSchema).min(1).max(20),
  schedule: scheduleSchema,
  pointsOverride: pointsSchema.optional(),
  approvalPolicyOverride: approvalPolicySchema.optional(),
});
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const updateAssignmentStatusSchema = z.object({
  familyId: uuidSchema,
  assignmentId: uuidSchema,
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]),
});

export const generateOccurrencesSchema = z.object({
  familyId: uuidSchema,
  childId: uuidSchema.optional(),
  from: localDateSchema,
  to: localDateSchema,
});
