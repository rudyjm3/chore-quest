import type { Prisma } from "@/generated/prisma/client";
import { adventureConfigSchema } from "@/game/schemas";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
import { log } from "@/lib/logging";
import { dbToLocalDate } from "@/lib/utils/dates";
import { sourceKeys } from "@/lib/utils/source-keys";

import { applyCompletionToQuests, awardCountAchievements } from "./adventure.service";
import { applyCompletionToGoals } from "./goal.service";
import { postLedgerEntry } from "./reward.service";

/**
 * Downstream pipeline for one verified ActivityCompletion:
 *   rewards (points, drip coins/xp) → goals → adventure quests → achievements.
 *
 * Runs in a single transaction with the child row locked, and every write is
 * keyed by a unique source so re-running after a crash is safe. The
 * completion's `processingStatus` records the outcome; `reprocessPending`
 * picks up anything left behind.
 */
export interface ProcessResult {
  completionId: string;
  status: "PROCESSED" | "ALREADY_PROCESSED" | "FAILED";
  goals: Array<{ goalAssignmentId: string; completed: boolean }>;
  quests: Array<{ questProgressId: string; objectiveKey: string; completed: boolean }>;
  achievements: string[];
}

export async function processCompletion(
  db: DbClient,
  completionId: string,
): Promise<ProcessResult> {
  try {
    return await db.$transaction(async (tx) => runPipeline(tx, completionId), { timeout: 20_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("completion pipeline failed", { completionId, message });
    await db.activityCompletion.update({
      where: { id: completionId },
      data: {
        processingStatus: "FAILED",
        processingAttempts: { increment: 1 },
        lastError: message.slice(0, 500),
      },
    });
    return { completionId, status: "FAILED", goals: [], quests: [], achievements: [] };
  }
}

async function runPipeline(
  tx: Prisma.TransactionClient,
  completionId: string,
): Promise<ProcessResult> {
  const completion = await tx.activityCompletion.findUniqueOrThrow({
    where: { id: completionId },
    include: { family: { select: { weekStartsOn: true } } },
  });
  await lockChildRow(tx, completion.childId);

  // Re-read after acquiring the lock: another worker may have finished it.
  const fresh = await tx.activityCompletion.findUniqueOrThrow({ where: { id: completionId } });
  if (fresh.processingStatus === "PROCESSED") {
    return { completionId, status: "ALREADY_PROCESSED", goals: [], quests: [], achievements: [] };
  }

  // 1. Parent points for the activity itself.
  if (completion.pointsAwarded > 0) {
    await postLedgerEntry(tx, {
      familyId: completion.familyId,
      childId: completion.childId,
      currency: "POINTS",
      amount: completion.pointsAwarded,
      sourceType: "ACTIVITY_COMPLETION",
      sourceId: completion.id,
      sourceKey: sourceKeys.activityReward(completion.id, "POINTS"),
      description: completion.sourceType === "ROUTINE_RUN" ? "Routine completed" : "Chore approved",
      completionId: completion.id,
    });
  }

  // 2. Drip game currency if the child is in an active adventure.
  const adventureProgress = await tx.childAdventureProgress.findFirst({
    where: { childId: completion.childId, status: "ACTIVE" },
    include: { adventure: { select: { config: true } } },
  });
  if (adventureProgress) {
    const config = adventureConfigSchema.parse(adventureProgress.adventure.config);
    for (const currency of ["COINS", "XP"] as const) {
      const amount = currency === "COINS" ? config.perActivity.coins : config.perActivity.xp;
      if (amount <= 0) continue;
      await postLedgerEntry(tx, {
        familyId: completion.familyId,
        childId: completion.childId,
        currency,
        amount,
        sourceType: "ACTIVITY_COMPLETION",
        sourceId: completion.id,
        sourceKey: sourceKeys.activityReward(completion.id, currency),
        description: "Adventure reward",
        completionId: completion.id,
      });
    }
  }

  // 3. Goals.
  const goals = await applyCompletionToGoals(
    tx,
    {
      id: completion.id,
      familyId: completion.familyId,
      childId: completion.childId,
      sourceType: completion.sourceType,
      taskId: completion.taskId,
      taskCategory: completion.taskCategory,
      routineId: completion.routineId,
      localDate: dbToLocalDate(completion.localDate),
    },
    { weekStartsOn: completion.family.weekStartsOn },
  );

  // 4. Adventure quests (no-op when no adventure is active).
  const quests = adventureProgress
    ? await applyCompletionToQuests(tx, {
        id: completion.id,
        familyId: completion.familyId,
        childId: completion.childId,
        sourceType: completion.sourceType,
        taskCategory: completion.taskCategory,
      })
    : [];

  // 5. Achievements.
  const achievements = await awardCountAchievements(tx, {
    familyId: completion.familyId,
    childId: completion.childId,
    completionId: completion.id,
  });

  await tx.activityCompletion.update({
    where: { id: completion.id },
    data: {
      processingStatus: "PROCESSED",
      processedAt: new Date(),
      processingAttempts: { increment: 1 },
      lastError: null,
    },
  });
  return { completionId, status: "PROCESSED", goals, quests, achievements };
}

/** Retry any completions whose pipeline did not finish (crash, timeout, bug fix). */
export async function reprocessPendingCompletions(db: DbClient, limit = 50) {
  const pending = await db.activityCompletion.findMany({
    where: { processingStatus: { in: ["PENDING", "FAILED"] }, processingAttempts: { lt: 10 } },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results: ProcessResult[] = [];
  for (const row of pending) results.push(await processCompletion(db, row.id));
  return results;
}
