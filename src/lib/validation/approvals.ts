import { z } from "zod";

import { uuidSchema } from "./common";

export const submitOccurrenceSchema = z.object({
  occurrenceId: uuidSchema,
  note: z.string().trim().max(300).optional(),
});
export type SubmitOccurrenceInput = z.infer<typeof submitOccurrenceSchema>;

export const reviewOccurrenceSchema = z.object({
  familyId: uuidSchema,
  occurrenceId: uuidSchema,
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(300).optional(),
});
export type ReviewOccurrenceInput = z.infer<typeof reviewOccurrenceSchema>;

export const reviewRoutineRunSchema = z.object({
  familyId: uuidSchema,
  runId: uuidSchema,
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().trim().max(300).optional(),
});
