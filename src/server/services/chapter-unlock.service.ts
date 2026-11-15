import type { Prisma } from "@/generated/prisma/client";
import { chapterUnlocked, type UnlockSnapshot } from "@/game/engine";
import { chapterConfigSchema, questConfigSchema } from "@/game/schemas";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
import type { ChildContext } from "@/server/policies/context";

type Tx = Prisma.TransactionClient;
type Reader = Tx | DbClient;

/**
 * Chapter unlocking, quest activation and the ensure step (ADR 0019). Split out of `adventure.service.ts`
 * so that `inventory.service.ts` can re-evaluate unlocks after a purchase without a circular import: this
 * module reads inventory itself and imports neither of them.
 */

/** Everything the unlock evaluator needs, read from the database for one child. */
export function buildSnapshot(
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

async function heldItems(db: Reader, childId: string): Promise<Record<string, number>> {
  const rows = await db.childInventoryItem.findMany({
    where: { childId },
    include: { item: { select: { key: true } } },
  });
  const map: Record<string, number> = {};
  for (const row of rows) map[row.item.key] = row.quantity;
  return map;
}

export async function activateQuest(
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

/**
 * Evaluate unlock rules for every LOCKED chapter; unlock and activate quests when satisfied. Unlocks are
 * never revoked: a chapter that is no longer LOCKED is not looked at again. Ends with the ensure step.
 */
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
  const inventory = await heldItems(tx, params.childId);
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
  await ensureChapterProgress(tx, params);
  return unlocked;
}

// ---------------------------------------------------------------------------
// Ensure step (ADR 0019)
// ---------------------------------------------------------------------------

interface EnsurePlan {
  /** Quests in reached chapters that have no active progress row yet. */
  activate: Array<{ id: string; chapterId: string }>;
  /** Missing objective rows of quests that are already ACTIVE. */
  objectiveRows: Array<{ questProgressId: string; objectiveId: string; targetCount: number }>;
}

/** What is missing for this child, read without a lock (a plan, never a write). */
async function planEnsure(
  db: Reader,
  params: { childId: string; adventureId: string },
): Promise<EnsurePlan> {
  const plan: EnsurePlan = { activate: [], objectiveRows: [] };
  const progress = await db.childAdventureProgress.findUnique({
    where: { childId_adventureId: { childId: params.childId, adventureId: params.adventureId } },
    include: { chapters: { where: { status: { in: ["UNLOCKED", "COMPLETED"] } } } },
  });
  if (!progress || progress.chapters.length === 0) return plan;
  const chapters = await db.adventureChapter.findMany({
    where: { id: { in: progress.chapters.map((c) => c.chapterId) } },
    include: { quests: { include: { objectives: { select: { id: true, targetCount: true } } } } },
  });
  const rows = await db.questProgress.findMany({
    where: { childId: params.childId, quest: { chapterId: { in: chapters.map((c) => c.id) } } },
    include: { objectives: { select: { objectiveId: true } } },
  });
  const byQuest = new Map(rows.map((r) => [r.questId, r]));
  for (const chapter of chapters) {
    const doneKeys = new Set(
      chapter.quests
        .filter((q) => ["COMPLETED", "CLAIMED"].includes(byQuest.get(q.id)?.status ?? ""))
        .map((q) => q.key),
    );
    for (const quest of chapter.quests) {
      const row = byQuest.get(quest.id);
      const required = questConfigSchema.parse(quest.config).requiresQuestKey;
      const eligible = !required || doneKeys.has(required);
      if (!row || row.status === "LOCKED") {
        if (eligible) plan.activate.push({ id: quest.id, chapterId: chapter.id });
      } else if (row.status === "ACTIVE") {
        const have = new Set(row.objectives.map((o) => o.objectiveId));
        for (const objective of quest.objectives) {
          if (!have.has(objective.id)) {
            plan.objectiveRows.push({
              questProgressId: row.id,
              objectiveId: objective.id,
              targetCount: objective.targetCount,
            });
          }
        }
      }
    }
  }
  return plan;
}

/**
 * Give a child every quest/objective progress row that their reached chapters should have (ADR 0019), for
 * example after a chapter that was a placeholder gained quests. Idempotent; call with the child lock held.
 * Never changes an existing row's status, never reopens a CLAIMED quest and never touches LOCKED chapters.
 */
export async function ensureChapterProgress(
  tx: Tx,
  params: { familyId: string; childId: string; adventureId: string },
) {
  const plan = await planEnsure(tx, params);
  for (const quest of plan.activate) {
    await activateQuest(tx, { familyId: params.familyId, childId: params.childId, quest });
  }
  if (plan.objectiveRows.length > 0) {
    await tx.objectiveProgress.createMany({ data: plan.objectiveRows, skipDuplicates: true });
  }
  return { questsActivated: plan.activate.length, objectiveRows: plan.objectiveRows.length };
}

/** The ensure step for every adventure the child is enrolled in (used by the completion pipeline). */
export async function ensureChildProgress(tx: Tx, params: { familyId: string; childId: string }) {
  const enrolled = await tx.childAdventureProgress.findMany({
    where: { childId: params.childId },
    select: { adventureId: true },
  });
  for (const { adventureId } of enrolled) {
    await ensureChapterProgress(tx, { ...params, adventureId });
  }
}

/** The same step for a child's own page load: a lock-free look first, a locked write only when needed. */
export async function ensureAdventureProgressForChild(
  db: DbClient,
  ctx: ChildContext,
  adventureKey: string,
) {
  const adventure = await db.adventure.findUnique({ where: { key: adventureKey } });
  if (!adventure) return { questsActivated: 0, objectiveRows: 0 };
  const params = { childId: ctx.childId, adventureId: adventure.id };
  const plan = await planEnsure(db, params);
  if (plan.activate.length === 0 && plan.objectiveRows.length === 0)
    return { questsActivated: 0, objectiveRows: 0 };
  return db.$transaction(async (tx) => {
    await lockChildRow(tx, ctx.childId);
    return ensureChapterProgress(tx, { ...params, familyId: ctx.familyId });
  });
}
