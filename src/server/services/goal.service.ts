import type { Prisma } from "@/generated/prisma/client";
import {
  applyContribution,
  completionMatchesGoal,
  effectiveTarget,
  goalPeriodKey,
  recomputeProgress,
} from "@/features/goals/progress";
import { lockChildRow, type DbClient } from "@/lib/db/prisma";
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
import type {
  AssignGoalInput,
  CreateGoalInput,
  UpdateGoalAssignmentInput,
  UpdateGoalInput,
} from "@/lib/validation/goals";
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
    where: {
      familyId,
      childId,
      status: { in: ["ACTIVE", "COMPLETED"] },
      goal: { isArchived: false },
    },
    include: { goal: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function listGoals(
  db: DbClient,
  familyId: string,
  options: { archived?: boolean } = {},
) {
  return db.goal.findMany({
    where: { familyId, isArchived: options.archived ?? false },
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
      effectiveTarget(goal.targetCount, target.targetOverride),
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
      await awardGoalCompletion(tx, target, goal);
    }
    touched.push({ goalAssignmentId: target.id, completed: update.completed });
  }
  return touched;
}

/**
 * Record the one-per-assignment GoalCompletion and credit its reward. Idempotent: the unique
 * goalAssignmentId and the ledger sourceKey both guard against a second award. Caller holds the
 * child row lock.
 */
async function awardGoalCompletion(
  tx: Prisma.TransactionClient,
  assignment: { id: string; familyId: string; childId: string },
  goal: { title: string; rewardPoints: number },
) {
  const existing = await tx.goalCompletion.findUnique({
    where: { goalAssignmentId: assignment.id },
  });
  const goalCompletion =
    existing ??
    (await tx.goalCompletion.create({
      data: {
        familyId: assignment.familyId,
        goalAssignmentId: assignment.id,
        childId: assignment.childId,
        pointsAwarded: goal.rewardPoints,
      },
    }));
  if (goal.rewardPoints > 0) {
    await postLedgerEntry(tx, {
      familyId: assignment.familyId,
      childId: assignment.childId,
      currency: "POINTS",
      amount: goalCompletion.pointsAwarded,
      sourceType: "GOAL_COMPLETION",
      sourceId: goalCompletion.id,
      sourceKey: sourceKeys.goalReward(goalCompletion.id, "POINTS"),
      description: `Goal reached: ${goal.title}`,
      goalCompletionId: goalCompletion.id,
    });
  }
  return goalCompletion;
}

// ---------------------------------------------------------------------------
// Goal management (Phase 3)
//
// Reset rules (see docs/gameplay/GOALS.md):
//  - recurrence NONE: one assignment per child; it never resets.
//  - recurrence WEEKLY (weekly-count goals only): every household week is its own assignment with
//    counters starting at zero. A new week's assignment is created by the first eligible
//    completion after the previous week closed, whether that week was ACTIVE, COMPLETED or
//    EXPIRED (the scheduled job marks past-due weeks EXPIRED; rolling forward keeps working).
//  - Streak goals do not reset on a calendar: a missed day restarts the current streak on the
//    next contribution; the best streak is kept.
// ---------------------------------------------------------------------------

/**
 * Edit a goal. Title, description, reward and target can change at any time; the type,
 * recurrence and eligibility filters are fixed once created (create a new goal and archive the
 * old one instead) so history is never reinterpreted. A new target applies to every ACTIVE
 * assignment that has no override of its own: lowering it below existing progress completes
 * them (and pays the reward once). COMPLETED/EXPIRED assignments keep their result. A reward
 * change only affects completions that happen afterwards.
 */
export async function updateGoal(db: DbClient, ctx: ParentContext, input: UpdateGoalInput) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const existing = await db.goal.findFirst({ where: { id: input.goalId, familyId: ctx.familyId } });
  if (!existing) throw AppError.notFound("Goal");

  const goal = await db.goal.update({
    where: { id: existing.id },
    data: {
      title: input.title,
      description: input.description ?? null,
      targetCount: input.targetCount,
      rewardPoints: input.rewardPoints,
      rewardDescription: input.rewardDescription ?? null,
    },
  });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "goal.update",
    entityType: "Goal",
    entityId: goal.id,
    metadata: {
      title: goal.title,
      targetCount: goal.targetCount,
      previousTargetCount: existing.targetCount,
      rewardPoints: goal.rewardPoints,
    },
  });

  if (existing.targetCount !== goal.targetCount || existing.rewardPoints !== goal.rewardPoints) {
    const active = await db.goalAssignment.findMany({
      where: { goalId: goal.id, familyId: ctx.familyId, status: "ACTIVE", targetOverride: null },
      select: { id: true },
    });
    for (const assignment of active) {
      await repairGoalAssignment(db, ctx.familyId, assignment.id);
    }
  }
  return goal;
}

export async function setGoalArchived(
  db: DbClient,
  ctx: ParentContext,
  input: { familyId: string; goalId: string; archived: boolean },
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const existing = await db.goal.findFirst({ where: { id: input.goalId, familyId: ctx.familyId } });
  if (!existing) throw AppError.notFound("Goal");
  if (existing.isArchived === input.archived) return existing;
  const goal = await db.goal.update({
    where: { id: existing.id },
    data: { isArchived: input.archived },
  });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: input.archived ? "goal.archive" : "goal.restore",
    entityType: "Goal",
    entityId: goal.id,
    metadata: { title: goal.title },
  });
  return goal;
}

/**
 * Edit one child's assignment: its own target and, for non-recurring goals, its dates.
 * Weekly assignments are pinned to their household week, so their dates are fixed.
 * Moving the end date of an EXPIRED assignment into the future reactivates it; moving an
 * ACTIVE assignment's end date into the past leaves it to the next expiry-job run.
 */
export async function updateGoalAssignment(
  db: DbClient,
  ctx: ParentContext,
  input: UpdateGoalAssignmentInput,
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const probe = await db.goalAssignment.findFirst({
    where: { id: input.assignmentId, familyId: ctx.familyId },
    select: { childId: true },
  });
  if (!probe) throw AppError.notFound("Goal assignment");

  // Status check, edit and repair share one transaction under the child lock, so an approval
  // cannot complete the assignment between the check and the update.
  return db.$transaction(async (tx) => {
    await lockChildRow(tx, probe.childId);
    const existing = await tx.goalAssignment.findFirst({
      where: { id: input.assignmentId, familyId: ctx.familyId },
      include: { goal: true },
    });
    if (!existing) throw AppError.notFound("Goal assignment");
    if (existing.status === "COMPLETED") {
      throw AppError.invalidState("A completed goal cannot be edited");
    }
    const datesChanging = input.startDate !== undefined || input.endDate !== undefined;
    if (datesChanging && existing.periodKey !== "") {
      throw AppError.invalidState(
        "Weekly goals follow the calendar week; their dates cannot change",
      );
    }

    const startDate = input.startDate ?? dbToLocalDate(existing.startDate);
    const endDate =
      input.endDate !== undefined
        ? input.endDate
        : existing.endDate
          ? dbToLocalDate(existing.endDate)
          : null;
    if (endDate && endDate < startDate) {
      throw AppError.validation("The end date cannot be before the start date");
    }

    await tx.goalAssignment.update({
      where: { id: existing.id },
      data: {
        ...(datesChanging
          ? {
              startDate: localDateToDb(startDate),
              endDate: endDate ? localDateToDb(endDate) : null,
            }
          : {}),
        targetOverride: input.targetCount === undefined ? undefined : input.targetCount,
        ...(existing.status === "EXPIRED" && (!endDate || endDate >= input.today)
          ? { status: "ACTIVE" as const }
          : {}),
      },
    });
    await recordAudit(tx, {
      familyId: ctx.familyId,
      actorType: "PARENT",
      actorUserId: ctx.userId,
      action: "goal.assignment.update",
      entityType: "GoalAssignment",
      entityId: existing.id,
      metadata: {
        goal: existing.goal.title,
        startDate,
        endDate,
        targetCount: input.targetCount ?? null,
      },
    });
    return repairGoalAssignment(tx, ctx.familyId, existing.id);
  });
}

export interface RepairResult {
  assignmentId: string;
  changed: boolean;
  completedNow: boolean;
  before: { progressCount: number; currentStreak: number; bestStreak: number };
  after: { progressCount: number; currentStreak: number; bestStreak: number };
}

/**
 * Recompute an assignment's cached counters from its `goal_contribution` rows (the source of
 * truth) and fix anything that drifted. Idempotent: a second run changes nothing. If the replay
 * shows an ACTIVE assignment has reached its target (for example after the target was lowered)
 * it is completed and the reward is paid once.
 */
export async function repairGoalAssignment(
  db: DbClient,
  familyId: string,
  assignmentId: string,
): Promise<RepairResult> {
  const probe = await db.goalAssignment.findFirst({
    where: { id: assignmentId, familyId },
    select: { childId: true },
  });
  if (!probe) throw AppError.notFound("Goal assignment");

  const run = async (tx: Prisma.TransactionClient): Promise<RepairResult> => {
    await lockChildRow(tx, probe.childId);
    const assignment = await tx.goalAssignment.findFirstOrThrow({
      where: { id: assignmentId, familyId },
      include: { goal: true },
    });
    const contributions = await tx.goalContribution.findMany({
      where: { goalAssignmentId: assignment.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { localDate: true, countedForStreak: true },
    });
    const target = effectiveTarget(assignment.goal.targetCount, assignment.targetOverride);
    const replay = recomputeProgress(
      assignment.goal.type,
      target,
      contributions.map((c) => ({
        localDate: dbToLocalDate(c.localDate),
        countedForStreak: c.countedForStreak,
      })),
    );

    const before = {
      progressCount: assignment.progressCount,
      currentStreak: assignment.currentStreak,
      bestStreak: assignment.bestStreak,
    };
    const after = {
      progressCount: replay.progressCount,
      currentStreak: replay.currentStreak,
      bestStreak: replay.bestStreak,
    };
    const lastDate = replay.lastContributionDate
      ? localDateToDb(replay.lastContributionDate)
      : null;
    const lastChanged =
      (assignment.lastContributionDate?.getTime() ?? null) !== (lastDate?.getTime() ?? null);
    const countersChanged =
      before.progressCount !== after.progressCount ||
      before.currentStreak !== after.currentStreak ||
      before.bestStreak !== after.bestStreak ||
      lastChanged;
    const completeNow = assignment.status === "ACTIVE" && replay.completed;

    if (countersChanged || completeNow) {
      await tx.goalAssignment.update({
        where: { id: assignment.id },
        data: {
          ...after,
          lastContributionDate: lastDate,
          ...(completeNow ? { status: "COMPLETED" as const, completedAt: new Date() } : {}),
        },
      });
    }
    if (completeNow) await awardGoalCompletion(tx, assignment, assignment.goal);
    return {
      assignmentId: assignment.id,
      changed: countersChanged || completeNow,
      completedNow: completeNow,
      before,
      after,
    };
  };

  // Callers inside a transaction pass the transaction client; otherwise open one.
  return "$transaction" in db ? db.$transaction(run) : run(db);
}

/** Repair every assignment of a goal (parent action). Audited when anything changed. */
export async function repairGoalProgress(
  db: DbClient,
  ctx: ParentContext,
  input: { familyId: string; goalId: string },
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const goal = await db.goal.findFirst({ where: { id: input.goalId, familyId: ctx.familyId } });
  if (!goal) throw AppError.notFound("Goal");
  const assignments = await db.goalAssignment.findMany({
    where: { goalId: goal.id, familyId: ctx.familyId },
    select: { id: true },
  });
  const results: RepairResult[] = [];
  for (const a of assignments) results.push(await repairGoalAssignment(db, ctx.familyId, a.id));
  const changed = results.filter((r) => r.changed).length;
  if (changed > 0) {
    await recordAudit(db, {
      familyId: ctx.familyId,
      actorType: "PARENT",
      actorUserId: ctx.userId,
      action: "goal.repair",
      entityType: "Goal",
      entityId: goal.id,
      metadata: { title: goal.title, assignmentsRepaired: changed },
    });
  }
  return results;
}
