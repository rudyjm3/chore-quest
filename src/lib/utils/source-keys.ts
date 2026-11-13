/**
 * Idempotency keys for ledger and inventory writes.
 *
 * Every reward credit and inventory grant is keyed by the record that caused
 * it, so re-running a pipeline step can never double-award. Keep all key
 * formats here so they stay unique across sources.
 */
import type { Currency } from "@/generated/prisma/enums";

export const sourceKeys = {
  activityReward: (completionId: string, currency: Currency) =>
    `activity:${completionId}:${currency}`,
  goalReward: (goalCompletionId: string, currency: Currency) =>
    `goal:${goalCompletionId}:${currency}`,
  questReward: (questProgressId: string, currency: Currency) =>
    `quest:${questProgressId}:${currency}`,
  questItem: (questProgressId: string, itemKey: string) =>
    `quest:${questProgressId}:item:${itemKey}`,
  chapterReward: (chapterProgressId: string, currency: Currency) =>
    `chapter:${chapterProgressId}:${currency}`,
  chapterItem: (chapterProgressId: string, itemKey: string) =>
    `chapter:${chapterProgressId}:item:${itemKey}`,
  objectiveItem: (objectiveProgressId: string, completionId: string) =>
    `objective:${objectiveProgressId}:completion:${completionId}`,
  puzzleItem: (puzzleAttemptId: string, itemKey: string) =>
    `puzzle:${puzzleAttemptId}:item:${itemKey}`,
  achievementReward: (earnedAchievementId: string, currency: Currency) =>
    `achievement:${earnedAchievementId}:${currency}`,
  achievementItem: (earnedAchievementId: string, itemKey: string) =>
    `achievement:${earnedAchievementId}:item:${itemKey}`,
  redemption: (redemptionId: string) => `redemption:${redemptionId}:POINTS`,
  redemptionRefund: (redemptionId: string) => `redemption-refund:${redemptionId}:POINTS`,
  purchaseDebit: (purchaseId: string) => `purchase:${purchaseId}:COINS`,
  purchaseItem: (purchaseId: string, itemKey: string) => `purchase:${purchaseId}:item:${itemKey}`,
  adventureStartItem: (adventureProgressId: string, itemKey: string) =>
    `adventure-start:${adventureProgressId}:item:${itemKey}`,
  locationItem: (
    adventureProgressId: string,
    chapterKey: string,
    locationKey: string,
    itemKey: string,
  ) => `location:${adventureProgressId}:${chapterKey}:${locationKey}:item:${itemKey}`,
  parentAdjustment: (adjustmentId: string, currency: Currency) =>
    `adjustment:${adjustmentId}:${currency}`,
  parentGrant: (grantId: string, itemKey: string) => `parent-grant:${grantId}:item:${itemKey}`,
} as const;
