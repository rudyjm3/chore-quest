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

export const bulkApproveSchema = z.object({
  familyId: uuidSchema,
  items: z
    .array(z.object({ kind: z.enum(["occurrence", "routine_run"]), id: uuidSchema }))
    .min(1)
    .max(50),
  note: z.string().trim().max(300).optional(),
});
export type BulkApproveInput = z.infer<typeof bulkApproveSchema>;
