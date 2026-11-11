import { z } from "zod";

/**
 * Declarative chapter configuration. Stored as JSON on `adventure_chapter.config`
 * and validated here at seed time and on load, so the engine never trusts raw JSON.
 */
export const positionSchema = z.object({
  /** Percent of the map width/height (0–100) so artwork can be swapped freely. */
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
});
export type Position = z.infer<typeof positionSchema>;

export const unlockRequirementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("CHAPTER_COMPLETED"), chapterKey: z.string() }),
  z.object({ type: z.literal("ITEM"), itemKey: z.string(), quantity: z.number().int().min(1) }),
  z.object({ type: z.literal("QUEST_COMPLETED"), chapterKey: z.string(), questKey: z.string() }),
  z.object({ type: z.literal("ALWAYS") }),
]);
export type UnlockRequirement = z.infer<typeof unlockRequirementSchema>;

export const itemRewardSchema = z.object({
  itemKey: z.string(),
  quantity: z.number().int().min(1).default(1),
});

export const rewardBundleSchema = z.object({
  coins: z.number().int().min(0).default(0),
  xp: z.number().int().min(0).default(0),
  items: z.array(itemRewardSchema).default([]),
});
export type RewardBundle = z.infer<typeof rewardBundleSchema>;

export const locationKindSchema = z.enum([
  "quest-board",
  "shop",
  "camp",
  "landmark",
  "puzzle",
  "npc",
  "harbor",
  "decorative",
]);

export const chapterLocationSchema = z.object({
  key: z.string(),
  name: z.string(),
  kind: locationKindSchema,
  position: positionSchema,
  /** Optional link into gameplay: a quest or puzzle this location opens. */
  questKey: z.string().optional(),
  puzzleKey: z.string().optional(),
  npcKey: z.string().optional(),
  description: z.string().optional(),
});
export type ChapterLocation = z.infer<typeof chapterLocationSchema>;

export const chapterConfigSchema = z.object({
  unlock: z.object({ requires: z.array(unlockRequirementSchema).default([]) }),
  completion: z.object({ requiresQuestKeys: z.array(z.string()).min(0) }),
  rewards: rewardBundleSchema,
  /** Position of this chapter's marker on the adventure world map. */
  mapMarker: positionSchema,
  locations: z.array(chapterLocationSchema).default([]),
  /** Scene asset key used by the renderer (resolved via the asset manifest). */
  sceneAssetKey: z.string().optional(),
});
export type ChapterConfig = z.infer<typeof chapterConfigSchema>;

export const objectiveEligibilitySchema = z.object({
  sourceTypes: z.array(z.enum(["TASK_OCCURRENCE", "ROUTINE_RUN"])).optional(),
  categories: z
    .array(z.enum(["CHORE", "HYGIENE", "SCHOOL", "PET_CARE", "HELPING", "OTHER"]))
    .optional(),
});

export const objectiveConfigSchema = z.object({
  eligibility: objectiveEligibilitySchema.default({}),
  /** Item granted per unit of progress (e.g. one supply crate per approved chore). */
  grantItemKey: z.string().optional(),
  grantQuantity: z.number().int().min(1).default(1),
  /** For COMPLETE_PUZZLE objectives. */
  puzzleKey: z.string().optional(),
  /** For COLLECT_ITEMS objectives. */
  itemKey: z.string().optional(),
  /** Objective only becomes available after another objective in the same quest completes. */
  requiresObjectiveKey: z.string().optional(),
});
export type ObjectiveConfig = z.infer<typeof objectiveConfigSchema>;

export const questConfigSchema = z.object({
  rewards: rewardBundleSchema.default({ coins: 0, xp: 0, items: [] }),
  /** Quest becomes ACTIVE when its chapter is unlocked unless it requires another quest. */
  requiresQuestKey: z.string().optional(),
});
export type QuestConfig = z.infer<typeof questConfigSchema>;

export const puzzleConfigSchema = z.object({
  rewards: rewardBundleSchema.default({ coins: 0, xp: 0, items: [] }),
  /** Type-specific payload validated by the puzzle verifier. */
  data: z.record(z.string(), z.unknown()),
});
export type PuzzleConfig = z.infer<typeof puzzleConfigSchema>;

export const adventureConfigSchema = z.object({
  /** Per-approved-activity drip rewards while this adventure is active. */
  perActivity: z.object({
    coins: z.number().int().min(0).default(0),
    xp: z.number().int().min(0).default(0),
  }),
  starterItems: z.array(itemRewardSchema).default([]),
  /** XP thresholds for player levels (index 0 = level 1 → 2). */
  levelThresholds: z.array(z.number().int().min(1)).default([]),
});
export type AdventureConfig = z.infer<typeof adventureConfigSchema>;
