import type { ChapterProgressStatus } from "@/generated/prisma/enums";

import type { UnlockRequirement } from "../schemas/chapter-config";

/** Everything the unlock evaluator needs, already loaded by the service layer. */
export interface UnlockSnapshot {
  chapterStatusByKey: Record<string, ChapterProgressStatus | undefined>;
  inventoryByItemKey: Record<string, number | undefined>;
  completedQuestKeys: Set<string>; // "chapterKey/questKey"
}

export function requirementSatisfied(req: UnlockRequirement, snapshot: UnlockSnapshot): boolean {
  switch (req.type) {
    case "ALWAYS":
      return true;
    case "CHAPTER_COMPLETED":
      return snapshot.chapterStatusByKey[req.chapterKey] === "COMPLETED";
    case "ITEM":
      return (snapshot.inventoryByItemKey[req.itemKey] ?? 0) >= req.quantity;
    case "QUEST_COMPLETED":
      return snapshot.completedQuestKeys.has(`${req.chapterKey}/${req.questKey}`);
    default:
      return false;
  }
}

/** A chapter unlocks when every requirement is satisfied (an empty list means always). */
export function chapterUnlocked(
  requirements: UnlockRequirement[],
  snapshot: UnlockSnapshot,
): boolean {
  return requirements.every((req) => requirementSatisfied(req, snapshot));
}

/** Missing requirements, for UI hints ("Collect 2 more supply crates"). */
export function missingRequirements(
  requirements: UnlockRequirement[],
  snapshot: UnlockSnapshot,
): UnlockRequirement[] {
  return requirements.filter((req) => !requirementSatisfied(req, snapshot));
}

/** A chapter is complete when all required quests are complete. */
export function chapterComplete(
  requiredQuestKeys: string[],
  completedQuestKeys: Set<string>,
): boolean {
  return requiredQuestKeys.every((key) => completedQuestKeys.has(key));
}

/** Player level from XP using cumulative thresholds (level 1 at 0 XP). */
export function levelForXp(xp: number, thresholds: number[]): number {
  let level = 1;
  for (const threshold of thresholds) {
    if (xp >= threshold) level += 1;
    else break;
  }
  return level;
}
