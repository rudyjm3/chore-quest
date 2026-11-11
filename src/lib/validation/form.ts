import type { z } from "zod";

import { AppError } from "@/lib/errors";

import { zodDetails } from "./common";

/**
 * Convert a FormData into a plain object:
 *  - repeated keys or keys ending in "[]" become arrays
 *  - empty strings become undefined (so optional fields validate)
 *  - keys listed in `numbers` are coerced to numbers
 *  - keys listed in `booleans` become true when present ("on"/"true")
 */
export function formToObject(
  formData: FormData,
  options: { numbers?: string[]; numberArrays?: string[]; booleans?: string[] } = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = new Set(Array.from(formData.keys()));
  for (const rawKey of keys) {
    const key = rawKey.endsWith("[]") ? rawKey.slice(0, -2) : rawKey;
    const values = formData.getAll(rawKey).filter((v): v is string => typeof v === "string");
    if (options.numberArrays?.includes(key)) {
      out[key] = values.filter((v) => v !== "").map(Number);
    } else if (rawKey.endsWith("[]") || values.length > 1) {
      out[key] = values.filter((v) => v !== "");
    } else {
      const value = values[0] ?? "";
      if (options.booleans?.includes(key)) out[key] = value === "on" || value === "true";
      else if (value === "") out[key] = undefined;
      else if (options.numbers?.includes(key)) out[key] = Number(value);
      else out[key] = value;
    }
  }
  for (const key of options.booleans ?? []) if (!(key in out)) out[key] = false;
  return out;
}

/** Parse with a schema and raise a typed validation error on failure. */
export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw AppError.validation("Please check the highlighted fields", zodDetails(result.error));
  }
  return result.data;
}
