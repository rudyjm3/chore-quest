import type { Prisma } from "@/generated/prisma/client";
import { applyContribution, completionMatchesGoal, goalPeriodKey } from "@/features/goals/progress";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import {
  dbToLocalDate,
  endOfWeek,
  isWithinRange,
  localDateToDb,
  startOfWeek,
  weekKey,
  type LocalDate,
} from "@/lib/utils/dates";
import { sourceKeys } from "@/lib/utils/source-keys";
import type { AssignGoalInput, CreateGoalInput } from "@/lib/validation/goals";
import type { ParentContext } from "@/server/policies/context";
import { assertFamilyScope, assertPermission } from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";
import { postLedgerEntry } from "./reward.service";

export async function createGoal(db: DbClient, ctx: ParentContext, input: CreateGoalInput) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const goal = await db.goal.create({
    data: {
      familyId: input.familyId,
      title: input.title,
      description: input.description,
      type: input.type,
      targetCount: input.targetCount,
      recurrence: input.recurrence,
      filterTaskId: input.filterTaskId,
      filterRoutineId: input.filterRoutineId,
      filterCategory: input.filterCategory,
      filterSourceType: input.type === "ROUTINE_CONSISTENCY" ? "ROUTINE_RUN" : undefined,
      rewardPoints: input.rewardPoints,
      rewardDescription: input.rewardDescription,
      createdById: ctx.userId,
    },
  });
  await recordAudit(db, {
    familyId: goal.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "goal.create",
    entityType: "Goal",
    entityId: goal.id,
  });
  return goal;
}

/**
 * Assign a goal to children. Weekly goals are pinned to the household week
 * containing `startDate`; recurring weekly goals roll forward automatically
 * when a contribution arrives in a later week.
 */
export async function assignGoal(db: DbClient, ctx: ParentContext, input: AssignGoalInput) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const goal = await db.goal.findFirst({
    where: { id: input.goalId, familyId: input.familyId, isArchived: false },
  });
  if (!goal) throw AppError.notFound("Goal");
  const children = await db.child.findMany({
    where: { id: { in: input.childIds }, familyId: input.familyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (children.length !== new Set(input.childIds).size) {
    throw AppError.forbidden("One or more children do not belong to this family");
  }

  let startDate = input.startDate;
  let endDate: LocalDate | null = input.endDate ?? null;
  let periodKey = "";
  if (goal.type === "WEEKLY_COUNT") {
    startDate = startOfWeek(input.startDate, ctx.weekStartsOn);
    endDate = endOfWeek(input.startDate, ctx.weekStartsOn);
    periodKey = weekKey(input.startDate, ctx.weekStartsOn);
  }

  return db.$transaction(
    children.map((child) =>
      db.goalAssignment.upsert({
        where: { goalId_childId_periodKey: { goalId: goal.id, childId: child.id, periodKey } },
        create: {
          familyId: input.familyId,
          goalId: goal.id,
          childId: child.id,
          periodKey,
          startDate: localDateToDb(startDate),
          endDate: endDate ? localDateToDb(endDate) : null,
        },
        update: {},
      }),
    ),
  );
}

export async function listGoalsForChild(db: DbClient, familyId: string, childId: string) {
  return db.goalAssignment.findMany({
    where: { familyId, childId, status: { in: ["ACTIVE", "COMPLETED"] } },
    include: { goal: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function listGoals(db: DbClient, familyId: string) {
  return db.goal.findMany({
    where: { familyId, isArchived: false },
    include: { assignments: { include: { child: { select: { id: true, displayName: true } } } } },
    orderBy: { createdAt: "desc" },
  });
}

export interface CompletionForGoals {
  id: string;
  familyId: string;
  childId: string;
  sourceType: "TASK_OCCURRENCE" | "ROUTINE_RUN";
  taskId: string | null;
  taskCategory: Prisma.ActivityCompletionGetPayload<object>["taskCategory"];
  routineId: string | null;
  localDate: LocalDate;
}

/**
 * Apply one verified completion to every eligible goal of the child.
 * Idempotent: (goalAssignmentId, completionId) is unique, so a reprocessed
 * completion is skipped per goal. Caller holds the child row lock.
 */
export async function applyCompletionToGoals(
  tx: Prisma.TransactionClient,
  completion: CompletionForGoals,
  household: { weekStartsOn: number },
) {
  const assignments = await tx.goalAssignment.findMany({
    where: {
      childId: completion.childId,
      familyId: completion.familyId,
      // COMPLETED and EXPIRED are included so a recurring weekly goal whose earlier week was
      // finished or lapsed (the scheduled job marks past-due periods EXPIRED) can still roll
      // forward. Closed periods themselves never take new contributions (checked below).
      status: { in: ["ACTIVE", "COMPLETED", "EXPIRED"] },
      goal: { isArchived: false },
    },
    include: { goal: true },
    orderBy: { startDate: "desc" },
  });

  const touched: Array<{ goalAssignmentId: string; completed: boolean }> = [];
  const seenGoalIds = new Set<string>();

  for (const assignment of assignments) {
    const goal = assignment.goal;
    if (seenGoalIds.has(goal.id)) continue;
    if (!completionMatchesGoal(goal, completion)) continue;

    if (assignment.status !== "ACTIVE" && goal.recurrence !== "WEEKLY") continue;

    let target = assignment;
    const start = dbToLocalDate(assignment.startDate);
    const end = assignment.endDate ? dbToLocalDate(assignment.endDate) : null;
    if (!isWithinRange(completion.localDate, start, end)) {
      if (goal.recurrence !== "WEEKLY" || completion.localDate < start) continue;
      // Roll a recurring weekly goal into the week of this completion.
      const key = goalPeriodKey(goal.type, weekKey(completion.localDate, household.weekStartsOn));
      target = await tx.goalAssignment.upsert({
        where: {
          goalId_childId_periodKey: {
            goalId: goal.id,
            childId: completion.childId,
            periodKey: key,
          },
        },
        create: {
          familyId: completion.familyId,
          goalId: goal.id,
          childId: completion.childId,
          periodKey: key,
          startDate: localDateToDb(startOfWeek(completion.localDate, household.weekStartsOn)),
          endDate: localDateToDb(endOfWeek(completion.localDate, household.weekStartsOn)),
        },
        update: {},
        include: { goal: true },
      });
    }
    seenGoalIds.add(goal.id);
    if (target.status !== "ACTIVE") continue;

    const already = await tx.goalContribution.findUnique({
      where: {
        goalAssignmentId_completionId: { goalAssignmentId: target.id, completionId: completion.id },
      },
    });
    if (already) continue;

    const update = applyContribution(
      goal.type,
      goal.targetCount,
      {
        progressCount: target.progressCount,
        currentStreak: target.currentStreak,
        bestStreak: target.bestStreak,
        lastContributionDate: target.lastContributionDate
          ? dbToLocalDate(target.lastContributionDate)
          : null,
      },
      completion.localDate,
    );

    await tx.goalContribution.create({
      data: {
        familyId: completion.familyId,
        goalAssignmentId: target.id,
        completionId: completion.id,
        localDate: localDateToDb(completion.localDate),
        countedForStreak: update.countedForStreak,
      },
    });
    if (!update.counted) continue;

    await tx.goalAssignment.update({
      where: { id: target.id },
      data: {
        progressCount: update.progressCount,
        currentStreak: update.currentStreak,
        bestStreak: update.bestStreak,
        lastContributionDate: localDateToDb(update.lastContributionDate ?? completion.localDate),
        ...(update.completed ? { status: "COMPLETED", completedAt: new Date() } : {}),
      },
    });

    if (update.completed) {
      const goalCompletion = await tx.goalCompletion.create({
        data: {
          familyId: completion.familyId,
          goalAssignmentId: target.id,
          childId: completion.childId,
          pointsAwarded: goal.rewardPoints,
        },
      });
      if (goal.rewardPoints > 0) {
        await postLedgerEntry(tx, {
          familyId: completion.familyId,
          childId: completion.childId,
          currency: "POINTS",
          amount: goal.rewardPoints,
          sourceType: "GOAL_COMPLETION",
          sourceId: goalCompletion.id,
          sourceKey: sourceKeys.goalReward(goalCompletion.id, "POINTS"),
          description: `Goal reached: ${goal.title}`,
          goalCompletionId: goalCompletion.id,
        });
      }
    }
    touched.push({ goalAssignmentId: target.id, completed: update.completed });
  }
  return touched;
}
