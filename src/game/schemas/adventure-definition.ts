import { z } from "zod";

import {
  adventureConfigSchema,
  chapterConfigSchema,
  objectiveConfigSchema,
  puzzleConfigSchema,
  questConfigSchema,
} from "./chapter-config";

/**
 * A complete adventure theme as authored in code (src/game/themes/<theme>/).
 * The seed script validates it with this schema before writing it to the DB.
 */
export const objectiveDefinitionSchema = z.object({
  key: z.string(),
  title: z.string(),
  type: z.enum([
    "APPROVED_ACTIVITIES",
    "COMPLETE_ROUTINES",
    "COMPLETE_PUZZLE",
    "COLLECT_ITEMS",
    "VISIT_LOCATION",
    "CUSTOM",
  ]),
  targetCount: z.number().int().min(1).default(1),
  config: objectiveConfigSchema,
});

export const questDefinitionSchema = z.object({
  key: z.string(),
  kind: z.enum(["MAIN", "SIDE"]).default("MAIN"),
  title: z.string(),
  description: z.string().optional(),
  rewardCoins: z.number().int().min(0).default(0),
  rewardXp: z.number().int().min(0).default(0),
  config: questConfigSchema,
  objectives: z.array(objectiveDefinitionSchema).min(1),
});

export const puzzleDefinitionSchema = z.object({
  key: z.string(),
  title: z.string(),
  type: z.string(),
  config: puzzleConfigSchema,
});

export const chapterDefinitionSchema = z.object({
  key: z.string(),
  sortOrder: z.number().int().min(1),
  title: z.string(),
  subtitle: z.string().optional(),
  locationName: z.string(),
  description: z.string().optional(),
  status: z.enum(["PLAYABLE", "PLACEHOLDER"]),
  config: chapterConfigSchema,
  quests: z.array(questDefinitionSchema).default([]),
  puzzles: z.array(puzzleDefinitionSchema).default([]),
});

export const itemDefinitionSchema = z.object({
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(["RESOURCE", "COLLECTIBLE", "COSMETIC", "SHIP", "SHIP_UPGRADE", "CONSUMABLE"]),
  rarity: z.enum(["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"]).default("COMMON"),
  iconKey: z.string().optional(),
  maxQuantity: z.number().int().min(1).optional(),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const achievementDefinitionSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  iconKey: z.string().optional(),
  criteria: z.discriminatedUnion("type", [
    z.object({ type: z.literal("APPROVED_ACTIVITY_COUNT"), count: z.number().int().min(1) }),
    z.object({ type: z.literal("ROUTINE_COUNT"), count: z.number().int().min(1) }),
    z.object({ type: z.literal("CHAPTER_COMPLETED"), chapterKey: z.string() }),
    z.object({ type: z.literal("PUZZLE_COMPLETED"), puzzleKey: z.string() }),
  ]),
  rewardCoins: z.number().int().min(0).default(0),
  rewardXp: z.number().int().min(0).default(0),
});

export const adventureDefinitionSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string().optional(),
  themeKey: z.string(),
  version: z.number().int().min(1),
  config: adventureConfigSchema,
  chapters: z.array(chapterDefinitionSchema).min(1),
  items: z.array(itemDefinitionSchema),
  achievements: z.array(achievementDefinitionSchema).default([]),
});

/** Parsed (output) types: defaults applied. */
export type AdventureDefinition = z.infer<typeof adventureDefinitionSchema>;
export type ChapterDefinition = z.infer<typeof chapterDefinitionSchema>;
export type QuestDefinition = z.infer<typeof questDefinitionSchema>;
export type ObjectiveDefinition = z.infer<typeof objectiveDefinitionSchema>;
/** Authoring (input) types: defaults optional. Use these in src/game/themes. */
export type AdventureDefinitionInput = z.input<typeof adventureDefinitionSchema>;
export type ItemDefinitionInput = z.input<typeof itemDefinitionSchema>;
export type AchievementDefinitionInput = z.input<typeof achievementDefinitionSchema>;
