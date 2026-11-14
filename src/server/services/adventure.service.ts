import type { Prisma } from "@/generated/prisma/client";
import type { ActivitySourceType, TaskCategory } from "@/generated/prisma/enums";
import {
  advanceObjective,
  chapterComplete,
  chapterUnlocked,
  completionMatchesObjective,
  isObjectiveComplete,
  levelForXp,
  missingRequirements,
  parseObjectiveConfig,
  type UnlockSnapshot,
} from "@/game/engine";
import { getPuzzleVerifier } from "@/game/puzzles";
import {
  adventureConfigSchema,
  chapterConfigSchema,
  puzzleConfigSchema,
  questConfigSchema,
  type RewardBundle,
} from "@/game/schemas";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { sourceKeys } from "@/lib/utils/source-keys";
import type { ChildContext } from "@/server/policies/context";

import { grantItem, inventoryByItemKey } from "./inventory.service";
import { getWallets, postLedgerEntry } from "./reward.service";

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Starting and reading an adventure
// ---------------------------------------------------------------------------

/** Enrol a child in an adventure: progress rows for every chapter, chapter 1 unlocked, starter items. Idempotent. */
export async function startAdventure(
  db: DbClient,
  params: { familyId: string; childId: string; adventureKey: string },
) {
  return db.$transaction(async (tx) => {
    await lockChildRow(tx, params.childId);
    const adventure = await tx.adventure.findUnique({
      where: { key: params.adventureKey },
      include: { chapters: { orderBy: { sortOrder: "asc" } } },
    });
    if (!adventure || !adventure.isActive) throw AppError.notFound("Adventure");

    const existing = await tx.childAdventureProgress.findUnique({
      where: { childId_adventureId: { childId: params.childId, adventureId: adventure.id } },
    });
    if (existing) return existing;

    const progress = await tx.childAdventureProgress.create({
      data: { familyId: params.familyId, childId: params.childId, adventureId: adventure.id },
    });
    await tx.childChapterProgress.createMany({
      data: adventure.chapters.map((chapter) => ({
        familyId: params.familyId,
        childId: params.childId,
        adventureProgressId: progress.id,
        chapterId: chapter.id,
      })),
      skipDuplicates: true,
    });

    const config = adventureConfigSchema.parse(adventure.config);
    for (const starter of config.starterItems) {
      await grantItem(tx, {
        familyId: params.familyId,
        childId: params.childId,
        itemKey: starter.itemKey,
        quantity: starter.quantity,
        sourceType: "CHAPTER_REWARD",
        sourceKey: sourceKeys.adventureStartItem(progress.id, starter.itemKey),
      });
    }
    await unlockEligibleChapters(tx, {
      familyId: params.familyId,
      childId: params.childId,
      adventureId: adventure.id,
    });
    return tx.childAdventureProgress.findUniqueOrThrow({ where: { id: progress.id } });
  });
}

/** Everything the child adventure UI needs for one adventure, in a single read. */
export async function getAdventureState(db: DbClient, ctx: ChildContext, adventureKey: string) {
  const adventure = await db.adventure.findUnique({
    where: { key: adventureKey },
    include: {
      chapters: {
        orderBy: { sortOrder: "asc" },
        include: {
          quests: {
            orderBy: { sortOrder: "asc" },
            include: { objectives: { orderBy: { sortOrder: "asc" } } },
          },
          puzzles: true,
        },
      },
    },
  });
  if (!adventure) throw AppError.notFound("Adventure");

  const progress = await db.childAdventureProgress.findUnique({
    where: { childId_adventureId: { childId: ctx.childId, adventureId: adventure.id } },
    include: { chapters: true },
  });
  const questProgress = await db.questProgress.findMany({
    where: { childId: ctx.childId, quest: { chapter: { adventureId: adventure.id } } },
    include: { objectives: true },
  });
  const inventory = await inventoryByItemKey(db, ctx.childId);
  const wallets = await getWallets(db, ctx.childId);
  const adventureConfig = adventureConfigSchema.parse(adventure.config);

  const chapterProgressById = new Map(progress?.chapters.map((c) => [c.chapterId, c]) ?? []);
  const questProgressById = new Map(questProgress.map((q) => [q.questId, q]));
  const snapshot = buildSnapshot(
    adventure.chapters,
    chapterProgressById,
    questProgressById,
    inventory,
  );

  return {
    adventure: {
      id: adventure.id,
      key: adventure.key,
      title: adventure.title,
      themeKey: adventure.themeKey,
    },
    started: Boolean(progress),
    wallets,
    level: levelForXp(wallets.XP, adventureConfig.levelThresholds),
    inventory,
    chapters: adventure.chapters.map((chapter) => {
      const config = chapterConfigSchema.parse(chapter.config);
      const cp = chapterProgressById.get(chapter.id);
      return {
        id: chapter.id,
        key: chapter.key,
        sortOrder: chapter.sortOrder,
        title: chapter.title,
        subtitle: chapter.subtitle,
        locationName: chapter.locationName,
        definitionStatus: chapter.status,
        status: cp?.status ?? "LOCKED",
        rewardClaimed: Boolean(cp?.rewardClaimedAt),
        rewards: config.rewards,
        mapMarker: config.mapMarker,
        locations: config.locations,
        sceneAssetKey: config.sceneAssetKey ?? null,
        hint: config.hint ?? null,
        missingRequirements:
          cp?.status === "LOCKED" ? missingRequirements(config.unlock.requires, snapshot) : [],
        quests: chapter.quests.map((quest) => {
          const qp = questProgressById.get(quest.id);
          return {
            id: quest.id,
            key: quest.key,
            kind: quest.kind,
            title: quest.title,
            description: quest.description,
            rewards: questConfigSchema.parse(quest.config).rewards,
            status: qp?.status ?? "LOCKED",
            objectives: quest.objectives.map((objective) => {
              const op = qp?.objectives.find((o) => o.objectiveId === objective.id);
              const objectiveConfig = parseObjectiveConfig(objective.config);
              const prereq = objectiveConfig.requiresObjectiveKey
                ? quest.objectives.find((o) => o.key === objectiveConfig.requiresObjectiveKey)
                : undefined;
              const prereqDone = prereq
                ? Boolean(qp?.objectives.find((o) => o.objectiveId === prereq.id)?.completedAt)
                : true;
              return {
                id: objective.id,
                key: objective.key,
                title: objective.title,
                type: objective.type,
                currentCount: op?.currentCount ?? 0,
                targetCount: objective.targetCount,
                completed: Boolean(op?.completedAt),
                /** Display hints only (ADR 0015); the server re-checks the gate when a puzzle is submitted. */
                puzzleKey: objectiveConfig.puzzleKey ?? null,
                available: prereqDone,
              };
            }),
          };
        }),
        puzzles: chapter.puzzles.map((p) => ({
          id: p.id,
          key: p.key,
          title: p.title,
          type: p.type,
        })),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Progression (called from the completion pipeline with the child lock held)
// ---------------------------------------------------------------------------

export interface CompletionForQuests {
  id: string;
  familyId: string;
  childId: string;
  sourceType: ActivitySourceType;
  taskCategory: TaskCategory | null;
}

/** Feed one verified completion into every ACTIVE quest objective that accepts it. */
export async function applyCompletionToQuests(tx: Tx, completion: CompletionForQuests) {
  const activeQuests = await tx.questProgress.findMany({
    where: { childId: completion.childId, status: "ACTIVE" },
    include: {
      quest: {
        include: {
          objectives: { orderBy: { sortOrder: "asc" } },
          chapter: { select: { id: true, adventureId: true } },
        },
      },
      objectives: true,
    },
  });

  const results: Array<{ questProgressId: string; objectiveKey: string; completed: boolean }> = [];
  for (const qp of activeQuests) {
    for (const objective of qp.quest.objectives) {
      const config = parseObjectiveConfig(objective.config);
      if (!completionMatchesObjective(objective.type, config, completion)) continue;
      if (config.requiresObjectiveKey) {
        const prereq = qp.quest.objectives.find((o) => o.key === config.requiresObjectiveKey);
        const prereqProgress = prereq
          ? qp.objectives.find((o) => o.objectiveId === prereq.id)
          : undefined;
        if (!prereqProgress?.completedAt) continue;
      }
      const op =
        qp.objectives.find((o) => o.objectiveId === objective.id) ??
        (await tx.objectiveProgress.create({
          data: {
            questProgressId: qp.id,
            objectiveId: objective.id,
            targetCount: objective.targetCount,
          },
        }));
      if (op.completedAt) continue;

      const already = await tx.questContribution.findUnique({
        where: {
          objectiveProgressId_completionId: {
            objectiveProgressId: op.id,
            completionId: completion.id,
          },
        },
      });
      if (already) continue;

      const { next, applied } = advanceObjective(op);
      if (applied === 0) continue;
      await tx.questContribution.create({
        data: {
          familyId: completion.familyId,
          objectiveProgressId: op.id,
          completionId: completion.id,
          amount: applied,
        },
      });
      const done = isObjectiveComplete({ currentCount: next, targetCount: op.targetCount });
      await tx.objectiveProgress.update({
        where: { id: op.id },
        data: { currentCount: next, completedAt: done ? new Date() : null },
      });
      if (config.grantItemKey) {
        await grantItem(tx, {
          familyId: completion.familyId,
          childId: completion.childId,
          itemKey: config.grantItemKey,
          quantity: config.grantQuantity * applied,
          sourceType: "OBJECTIVE_PROGRESS",
          sourceKey: sourceKeys.objectiveItem(op.id, completion.id),
        });
      }
      results.push({ questProgressId: qp.id, objectiveKey: objective.key, completed: done });
      if (done) await evaluateQuestCompletion(tx, qp.id);
      // One completion contributes to at most one objective per quest.
      break;
    }
  }
  return results;
}

/** If every objective of a quest is complete: grant quest rewards once, mark CLAIMED, unlock dependents, evaluate chapter. */
export async function evaluateQuestCompletion(tx: Tx, questProgressId: string) {
  const qp = await tx.questProgress.findUniqueOrThrow({
    where: { id: questProgressId },
    include: { quest: { include: { objectives: true, chapter: true } }, objectives: true },
  });
  if (qp.status !== "ACTIVE") return false;
  const allDone = qp.quest.objectives.every(
    (o) => qp.objectives.find((p) => p.objectiveId === o.id)?.completedAt,
  );
  if (!allDone) return false;

  const config = questConfigSchema.parse(qp.quest.config);
  await grantRewardBundle(tx, {
    familyId: qp.familyId,
    childId: qp.childId,
    bundle: { coins: qp.quest.rewardCoins, xp: qp.quest.rewardXp, items: config.rewards.items },
    sourceType: "QUEST_REWARD",
    sourceId: qp.id,
    currencyKey: (currency) => sourceKeys.questReward(qp.id, currency),
    itemKey: (itemKey) => sourceKeys.questItem(qp.id, itemKey),
    description: `Quest complete: ${qp.quest.title}`,
  });
  await tx.questProgress.update({
    where: { id: qp.id },
    data: { status: "CLAIMED", completedAt: new Date(), claimedAt: new Date() },
  });

  // Unlock quests in the same chapter that required this one.
  const siblings = await tx.adventureQuest.findMany({ where: { chapterId: qp.quest.chapterId } });
  for (const sibling of siblings) {
    const siblingConfig = questConfigSchema.parse(sibling.config);
    if (siblingConfig.requiresQuestKey === qp.quest.key) {
      await activateQuest(tx, { familyId: qp.familyId, childId: qp.childId, quest: sibling });
    }
  }
  await evaluateChapterCompletion(tx, {
    familyId: qp.familyId,
    childId: qp.childId,
    chapterId: qp.quest.chapterId,
  });
  return true;
}

async function activateQuest(
  tx: Tx,
  params: { familyId: string; childId: string; quest: { id: string; chapterId: string } },
) {
  const objectives = await tx.questObjective.findMany({ where: { questId: params.quest.id } });
  const existing = await tx.questProgress.findUnique({
    where: { childId_questId: { childId: params.childId, questId: params.quest.id } },
  });
  const qp =
    existing ??
    (await tx.questProgress.create({
      data: {
        familyId: params.familyId,
        childId: params.childId,
        questId: params.quest.id,
        status: "LOCKED",
      },
    }));
  if (qp.status === "LOCKED") {
    await tx.questProgress.update({
      where: { id: qp.id },
      data: { status: "ACTIVE", startedAt: new Date() },
    });
  }
  await tx.objectiveProgress.createMany({
    data: objectives.map((o) => ({
      questProgressId: qp.id,
      objectiveId: o.id,
      targetCount: o.targetCount,
    })),
    skipDuplicates: true,
  });
  return qp;
}

/** Mark the chapter COMPLETED when its required quests are done, then try to unlock the next ones. */
export async function evaluateChapterCompletion(
  tx: Tx,
  params: { familyId: string; childId: string; chapterId: string },
) {
  const chapter = await tx.adventureChapter.findUniqueOrThrow({
    where: { id: params.chapterId },
    include: { quests: true },
  });
  const config = chapterConfigSchema.parse(chapter.config);
  const cp = await tx.childChapterProgress.findUnique({
    where: { childId_chapterId: { childId: params.childId, chapterId: chapter.id } },
  });
  if (!cp || cp.status === "COMPLETED" || cp.status === "LOCKED") return false;

  const completedKeys = new Set<string>();
  const progress = await tx.questProgress.findMany({
    where: {
      childId: params.childId,
      questId: { in: chapter.quests.map((q) => q.id) },
      status: { in: ["COMPLETED", "CLAIMED"] },
    },
    include: { quest: { select: { key: true } } },
  });
  for (const p of progress) completedKeys.add(p.quest.key);
  if (
    chapter.status === "PLACEHOLDER" ||
    !chapterComplete(config.completion.requiresQuestKeys, completedKeys)
  )
    return false;

  await tx.childChapterProgress.update({
    where: { id: cp.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  await awardAchievementsForChapter(tx, {
    familyId: params.familyId,
    childId: params.childId,
    chapterKey: chapter.key,
  });
  await unlockEligibleChapters(tx, {
    familyId: params.familyId,
    childId: params.childId,
    adventureId: chapter.adventureId,
  });
  return true;
}

/** Evaluate unlock rules for every LOCKED chapter; unlock and activate quests when satisfied. */
export async function unlockEligibleChapters(
  tx: Tx,
  params: { familyId: string; childId: string; adventureId: string },
) {
  const chapters = await tx.adventureChapter.findMany({
    where: { adventureId: params.adventureId },
    orderBy: { sortOrder: "asc" },
    include: { quests: true },
  });
  const progress = await tx.childAdventureProgress.findUnique({
    where: { childId_adventureId: { childId: params.childId, adventureId: params.adventureId } },
    include: { chapters: true },
  });
  if (!progress) return [];
  const questProgress = await tx.questProgress.findMany({
    where: { childId: params.childId, quest: { chapter: { adventureId: params.adventureId } } },
    include: { objectives: true },
  });
  const inventory = await inventoryByItemKey(tx, params.childId);
  const chapterProgressById = new Map(progress.chapters.map((c) => [c.chapterId, c]));
  const questProgressById = new Map(questProgress.map((q) => [q.questId, q]));
  const snapshot = buildSnapshot(chapters, chapterProgressById, questProgressById, inventory);

  const unlocked: string[] = [];
  for (const chapter of chapters) {
    const cp = chapterProgressById.get(chapter.id);
    if (!cp || cp.status !== "LOCKED") continue;
    const config = chapterConfigSchema.parse(chapter.config);
    if (!chapterUnlocked(config.unlock.requires, snapshot)) continue;

    await tx.childChapterProgress.update({
      where: { id: cp.id },
      data: { status: "UNLOCKED", unlockedAt: new Date() },
    });
    snapshot.chapterStatusByKey[chapter.key] = "UNLOCKED";
    for (const quest of chapter.quests) {
      const questConfig = questConfigSchema.parse(quest.config);
      if (!questConfig.requiresQuestKey) {
        await activateQuest(tx, { familyId: params.familyId, childId: params.childId, quest });
      }
    }
    await tx.childAdventureProgress.update({
      where: { id: progress.id },
      data: { currentChapterId: chapter.id },
    });
    unlocked.push(chapter.key);
  }
  return unlocked;
}

/** Child claims a completed chapter's reward bundle. Idempotent via rewardClaimedAt + source keys. */
export async function claimChapterReward(db: DbClient, ctx: ChildContext, chapterId: string) {
  return db.$transaction(async (tx) => {
    await lockChildRow(tx, ctx.childId);
    const cp = await tx.childChapterProgress.findFirst({
      where: { chapterId, childId: ctx.childId, familyId: ctx.familyId },
      include: { chapter: true },
    });
    if (!cp) throw AppError.notFound("Chapter");
    if (cp.status !== "COMPLETED") throw AppError.invalidState("Finish the chapter first");
    if (cp.rewardClaimedAt) return { claimed: false as const, chapterProgress: cp };

    const config = chapterConfigSchema.parse(cp.chapter.config);
    await grantRewardBundle(tx, {
      familyId: ctx.familyId,
      childId: ctx.childId,
      bundle: config.rewards,
      sourceType: "CHAPTER_REWARD",
      sourceId: cp.id,
      currencyKey: (currency) => sourceKeys.chapterReward(cp.id, currency),
      itemKey: (itemKey) => sourceKeys.chapterItem(cp.id, itemKey),
      description: `Chapter complete: ${cp.chapter.title}`,
    });
    const updated = await tx.childChapterProgress.update({
      where: { id: cp.id },
      data: { rewardClaimedAt: new Date() },
    });
    await unlockEligibleChapters(tx, {
      familyId: ctx.familyId,
      childId: ctx.childId,
      adventureId: cp.chapter.adventureId,
    });
    return { claimed: true as const, chapterProgress: updated };
  });
}

/** Child submits a puzzle answer. Verified server-side; completion recorded at most once. */
/**
 * A puzzle as the browser may see it (ADR 0015): `view` comes from the verifier's `toClientView`, so it
 * never contains the answer. Scoped to the child: refuses chapters the child has not unlocked.
 */
export async function getPuzzleForChild(
  db: DbClient,
  ctx: ChildContext,
  params: { adventureKey: string; chapterKey: string; puzzleKey: string },
) {
  const puzzle = await db.puzzleDefinition.findFirst({
    where: {
      key: params.puzzleKey,
      chapter: { key: params.chapterKey, adventure: { key: params.adventureKey } },
    },
  });
  if (!puzzle) throw AppError.notFound("Puzzle");
  const [cp, solved] = await Promise.all([
    db.childChapterProgress.findUnique({
      where: { childId_chapterId: { childId: ctx.childId, chapterId: puzzle.chapterId } },
    }),
    db.puzzleAttempt.findFirst({
      where: { childId: ctx.childId, puzzleId: puzzle.id, status: "COMPLETED" },
      select: { id: true },
    }),
  ]);
  if (!cp || cp.status === "LOCKED") throw AppError.forbidden("This puzzle is not available yet");
  const config = puzzleConfigSchema.parse(puzzle.config);
  const verifier = getPuzzleVerifier(puzzle.type);
  return {
    id: puzzle.id,
    key: puzzle.key,
    title: puzzle.title,
    type: puzzle.type,
    solved: Boolean(solved),
    view: verifier.toClientView(verifier.parseConfig(config.data)),
  };
}

export async function submitPuzzleAnswer(
  db: DbClient,
  ctx: ChildContext,
  puzzleId: string,
  answer: unknown,
) {
  return db.$transaction(async (tx) => {
    await lockChildRow(tx, ctx.childId);
    const puzzle = await tx.puzzleDefinition.findUnique({
      where: { id: puzzleId },
      include: { chapter: true },
    });
    if (!puzzle) throw AppError.notFound("Puzzle");
    const cp = await tx.childChapterProgress.findUnique({
      where: { childId_chapterId: { childId: ctx.childId, chapterId: puzzle.chapterId } },
    });
    if (!cp || cp.status === "LOCKED") throw AppError.forbidden("This puzzle is not available yet");

    const prior = await tx.puzzleAttempt.findFirst({
      where: { childId: ctx.childId, puzzleId: puzzle.id, status: "COMPLETED" },
    });
    if (prior)
      return {
        correct: true as const,
        alreadyCompleted: true as const,
        feedback: "Already solved!",
      };

    // The puzzle objective must be reachable (prerequisite objectives done).
    const gate = await puzzleObjectiveGate(tx, ctx.childId, puzzle.chapterId, puzzle.key);
    if (!gate.available) throw AppError.invalidState(gate.reason ?? "Not yet");

    const config = puzzleConfigSchema.parse(puzzle.config);
    const verifier = getPuzzleVerifier(puzzle.type);
    const verdict = verifier.verify(verifier.parseConfig(config.data), answer);
    const attempt = await tx.puzzleAttempt.create({
      data: {
        familyId: ctx.familyId,
        childId: ctx.childId,
        puzzleId: puzzle.id,
        status: verdict.correct ? "COMPLETED" : "FAILED",
        attemptData: JSON.parse(JSON.stringify({ answer })),
        completedAt: verdict.correct ? new Date() : null,
      },
    });
    if (!verdict.correct)
      return {
        correct: false as const,
        alreadyCompleted: false as const,
        feedback: verdict.feedback,
      };

    await grantRewardBundle(tx, {
      familyId: ctx.familyId,
      childId: ctx.childId,
      bundle: config.rewards,
      sourceType: "QUEST_REWARD",
      sourceId: attempt.id,
      currencyKey: (currency) => `puzzle:${attempt.id}:${currency}`,
      itemKey: (itemKey) => sourceKeys.puzzleItem(attempt.id, itemKey),
      description: `Puzzle solved: ${puzzle.title}`,
    });
    // Advance COMPLETE_PUZZLE objectives in this chapter.
    if (gate.objectiveProgressId) {
      await tx.objectiveProgress.update({
        where: { id: gate.objectiveProgressId },
        data: { currentCount: 1, completedAt: new Date() },
      });
      await evaluateQuestCompletion(tx, gate.questProgressId!);
    }
    await awardAchievementsForPuzzle(tx, {
      familyId: ctx.familyId,
      childId: ctx.childId,
      puzzleKey: puzzle.key,
    });
    return { correct: true as const, alreadyCompleted: false as const, feedback: verdict.feedback };
  });
}

async function puzzleObjectiveGate(tx: Tx, childId: string, chapterId: string, puzzleKey: string) {
  const quests = await tx.questProgress.findMany({
    where: { childId, status: "ACTIVE", quest: { chapterId } },
    include: { quest: { include: { objectives: true } }, objectives: true },
  });
  for (const qp of quests) {
    for (const objective of qp.quest.objectives) {
      if (objective.type !== "COMPLETE_PUZZLE") continue;
      const config = parseObjectiveConfig(objective.config);
      if (config.puzzleKey !== puzzleKey) continue;
      if (config.requiresObjectiveKey) {
        const prereq = qp.quest.objectives.find((o) => o.key === config.requiresObjectiveKey);
        const prereqProgress = prereq
          ? qp.objectives.find((o) => o.objectiveId === prereq.id)
          : undefined;
        if (!prereqProgress?.completedAt) {
          return {
            available: false,
            reason: `Finish "${prereq?.title ?? "the previous step"}" first`,
          };
        }
      }
      const op =
        qp.objectives.find((o) => o.objectiveId === objective.id) ??
        (await tx.objectiveProgress.create({
          data: {
            questProgressId: qp.id,
            objectiveId: objective.id,
            targetCount: objective.targetCount,
          },
        }));
      return { available: true, objectiveProgressId: op.id, questProgressId: qp.id };
    }
  }
  // Puzzle not tied to an active objective: allow play, no quest progress.
  return { available: true };
}

// ---------------------------------------------------------------------------
// Rewards & achievements
// ---------------------------------------------------------------------------

async function grantRewardBundle(
  tx: Tx,
  params: {
    familyId: string;
    childId: string;
    bundle: RewardBundle;
    sourceType: "QUEST_REWARD" | "CHAPTER_REWARD" | "ACHIEVEMENT";
    sourceId: string;
    currencyKey: (currency: "COINS" | "XP") => string;
    itemKey: (itemKey: string) => string;
    description: string;
  },
) {
  const inventorySource =
    params.sourceType === "CHAPTER_REWARD"
      ? "CHAPTER_REWARD"
      : params.sourceType === "ACHIEVEMENT"
        ? "ACHIEVEMENT"
        : "QUEST_REWARD";
  for (const currency of ["COINS", "XP"] as const) {
    const amount = currency === "COINS" ? params.bundle.coins : params.bundle.xp;
    if (amount <= 0) continue;
    await postLedgerEntry(tx, {
      familyId: params.familyId,
      childId: params.childId,
      currency,
      amount,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceKey: params.currencyKey(currency),
      description: params.description,
    });
  }
  for (const item of params.bundle.items) {
    await grantItem(tx, {
      familyId: params.familyId,
      childId: params.childId,
      itemKey: item.itemKey,
      quantity: item.quantity,
      sourceType: inventorySource,
      sourceKey: params.itemKey(item.itemKey),
    });
  }
}

async function earnAchievement(
  tx: Tx,
  params: { familyId: string; childId: string; achievementId: string; completionId?: string },
) {
  const existing = await tx.earnedAchievement.findUnique({
    where: {
      childId_achievementId: { childId: params.childId, achievementId: params.achievementId },
    },
  });
  if (existing) return null;
  const definition = await tx.achievementDefinition.findUniqueOrThrow({
    where: { id: params.achievementId },
  });
  const earned = await tx.earnedAchievement.create({
    data: {
      familyId: params.familyId,
      childId: params.childId,
      achievementId: definition.id,
      completionId: params.completionId,
    },
  });
  await grantRewardBundle(tx, {
    familyId: params.familyId,
    childId: params.childId,
    bundle: { coins: definition.rewardCoins, xp: definition.rewardXp, items: [] },
    sourceType: "ACHIEVEMENT",
    sourceId: earned.id,
    currencyKey: (currency) => sourceKeys.achievementReward(earned.id, currency),
    itemKey: (itemKey) => sourceKeys.achievementItem(earned.id, itemKey),
    description: `Achievement: ${definition.title}`,
  });
  return earned;
}

/** Count-based achievements, evaluated after each verified completion. */
export async function awardCountAchievements(
  tx: Tx,
  params: { familyId: string; childId: string; completionId: string },
) {
  // Sequential on purpose: a transaction client owns a single connection.
  const activityCount = await tx.activityCompletion.count({ where: { childId: params.childId } });
  const routineCount = await tx.activityCompletion.count({
    where: { childId: params.childId, sourceType: "ROUTINE_RUN" },
  });
  const definitions = await activeAchievementDefinitions(tx, params.childId);
  const earned: string[] = [];
  for (const def of definitions) {
    const criteria = def.criteria as { type: string; count?: number };
    const hit =
      (criteria.type === "APPROVED_ACTIVITY_COUNT" &&
        activityCount >= (criteria.count ?? Infinity)) ||
      (criteria.type === "ROUTINE_COUNT" && routineCount >= (criteria.count ?? Infinity));
    if (!hit) continue;
    const result = await earnAchievement(tx, { ...params, achievementId: def.id });
    if (result) earned.push(def.key);
  }
  return earned;
}

/** Platform-wide achievements plus those of adventures the child is actively playing. */
async function activeAchievementDefinitions(tx: Tx, childId: string) {
  const active = await tx.childAdventureProgress.findMany({
    where: { childId, status: "ACTIVE" },
    select: { adventure: { select: { key: true } } },
  });
  const keys = active.map((a) => a.adventure.key);
  return tx.achievementDefinition.findMany({
    where: { isActive: true, OR: [{ adventureKey: null }, { adventureKey: { in: keys } }] },
  });
}

async function awardAchievementsForChapter(
  tx: Tx,
  params: { familyId: string; childId: string; chapterKey: string },
) {
  const definitions = await activeAchievementDefinitions(tx, params.childId);
  for (const def of definitions) {
    const criteria = def.criteria as { type: string; chapterKey?: string };
    if (criteria.type === "CHAPTER_COMPLETED" && criteria.chapterKey === params.chapterKey) {
      await earnAchievement(tx, {
        familyId: params.familyId,
        childId: params.childId,
        achievementId: def.id,
      });
    }
  }
}

async function awardAchievementsForPuzzle(
  tx: Tx,
  params: { familyId: string; childId: string; puzzleKey: string },
) {
  const definitions = await activeAchievementDefinitions(tx, params.childId);
  for (const def of definitions) {
    const criteria = def.criteria as { type: string; puzzleKey?: string };
    if (criteria.type === "PUZZLE_COMPLETED" && criteria.puzzleKey === params.puzzleKey) {
      await earnAchievement(tx, {
        familyId: params.familyId,
        childId: params.childId,
        achievementId: def.id,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSnapshot(
  chapters: Array<{ id: string; key: string; quests: Array<{ id: string; key: string }> }>,
  chapterProgressById: Map<string, { status: UnlockSnapshot["chapterStatusByKey"][string] }>,
  questProgressById: Map<string, { status: string }>,
  inventory: Record<string, number>,
): UnlockSnapshot {
  const chapterStatusByKey: UnlockSnapshot["chapterStatusByKey"] = {};
  const completedQuestKeys = new Set<string>();
  for (const chapter of chapters) {
    chapterStatusByKey[chapter.key] = chapterProgressById.get(chapter.id)?.status;
    for (const quest of chapter.quests) {
      const status = questProgressById.get(quest.id)?.status;
      if (status === "COMPLETED" || status === "CLAIMED")
        completedQuestKeys.add(`${chapter.key}/${quest.key}`);
    }
  }
  return { chapterStatusByKey, inventoryByItemKey: inventory, completedQuestKeys };
}
