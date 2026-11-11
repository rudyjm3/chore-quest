import { z } from "zod";

import { isLocalDate, isValidTimeZone } from "@/lib/utils/dates";

export const uuidSchema = z.uuid();

export const localDateSchema = z
  .string()
  .refine(isLocalDate, { message: "Expected a calendar date in YYYY-MM-DD format" });

export const timeOfDaySchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a time in HH:mm format");

export const timeZoneSchema = z
  .string()
  .min(1)
  .refine(isValidTimeZone, { message: "Unknown IANA timezone" });

export const dayOfWeekSchema = z.number().int().min(0).max(6);

export const pointsSchema = z.number().int().min(0).max(10_000);

export const shortTextSchema = z.string().trim().min(1).max(80);
export const longTextSchema = z.string().trim().max(1_000);

export const paginationSchema = z.object({
  cursor: uuidSchema.optional(),
  limit: z.number().int().min(1).max(100).default(25),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const idempotencyKeySchema = z.string().trim().min(8).max(128);

/** Convert a Zod error into the `details` shape used by AppError. */
export function zodDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_";
    (details[key] ??= []).push(issue.message);
  }
  return details;
}
