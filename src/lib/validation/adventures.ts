import { z } from "zod";

import { uuidSchema } from "./common";

export const startAdventureSchema = z.object({
  adventureKey: z.string().min(1).max(64),
});

export const claimChapterRewardSchema = z.object({
  chapterId: uuidSchema,
});

export const submitPuzzleSchema = z.object({
  puzzleId: uuidSchema,
  /** Puzzle-type specific answer payload, validated by the puzzle verifier. */
  answer: z.unknown(),
});

export const purchaseItemSchema = z.object({
  itemKey: z.string().min(1).max(64),
  idempotencyKey: z.string().trim().min(8).max(128),
});

export const equipCosmeticSchema = z.object({
  slot: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z][a-z0-9-]*$/),
  /** Empty string means "take it off". */
  itemKey: z.string().trim().max(64).default(""),
});

export const visitLocationSchema = z.object({
  chapterKey: z.string().min(1).max(64),
  locationKey: z.string().min(1).max(64),
});
