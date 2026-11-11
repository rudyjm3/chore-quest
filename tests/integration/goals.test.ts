import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { reviewOccurrence } from "@/server/services/approval.service";
import { assignGoal, createGoal } from "@/server/services/goal.service";
import { getWallets } from "@/server/services/reward.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import {
  createChildFixture,
  createFamilyFixture,
  createOccurrenceFixture,
  createTaskFixture,
} from "../helpers/fixtures";

const db = testDb();

beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

async function approveOn(params: {
  family: { id: string };
  ctx: Parameters<typeof reviewOccurrence>[1];
  childId: string;
  taskId: string;
  localDate: string;
  title?: string;
}) {
  const { occurrence } = await createOccurrenceFixture(db, {
    familyId: params.family.id,
    childId: params.childId,
    taskId: params.taskId,
    localDate: params.localDate,
  });
  return reviewOccurrence(db, params.ctx, {
    familyId: params.family.id,
    occurrenceId: occurrence.id,
    decision: "APPROVED",
  });
}

describe("goals", () => {
  it("one verified chore contributes to multiple eligible goals without duplicate completions", async () => {
    const { family, ctx } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id, { category: "CHORE" });
    const total = await createGoal(db, ctx, {
      familyId: family.id,
      title: "Any 1 chore",
      type: "TOTAL_COUNT",
      targetCount: 1,
      recurrence: "NONE",
      rewardPoints: 10,
    });
    const chores = await createGoal(db, ctx, {
      familyId: family.id,
      title: "Chores 3",
      type: "TOTAL_COUNT",
      targetCount: 3,
      recurrence: "NONE",
      filterCategory: "CHORE",
      rewardPoints: 0,
    });
    const hygiene = await createGoal(db, ctx, {
      familyId: family.id,
      title: "Hygiene",
      type: "TOTAL_COUNT",
      targetCount: 3,
      recurrence: "NONE",
      filterCategory: "HYGIENE",
      rewardPoints: 0,
    });
    for (const goal of [total, chores, hygiene]) {
      await assignGoal(db, ctx, {
        familyId: family.id,
        goalId: goal.id,
        childIds: [child.id],
        startDate: "2026-11-01",
      });
    }

    const outcome = await approveOn({
      family,
      ctx,
      childId: child.id,
      taskId: task.id,
      localDate: "2026-11-10",
    });
    expect(outcome.processing?.goals.length).toBe(2);
    expect(await db.activityCompletion.count({ where: { childId: child.id } })).toBe(1);
    expect(await db.goalContribution.count()).toBe(2);

    const totalAssignment = await db.goalAssignment.findFirstOrThrow({
      where: { goalId: total.id },
    });
    expect(totalAssignment.status).toBe("COMPLETED");
    expect(await db.goalCompletion.count({ where: { goalAssignmentId: totalAssignment.id } })).toBe(
      1,
    );
    // 5 points for the chore + 10 for the goal
    expect((await getWallets(db, child.id)).POINTS).toBe(15);
    const hygieneAssignment = await db.goalAssignment.findFirstOrThrow({
      where: { goalId: hygiene.id },
    });
    expect(hygieneAssignment.progressCount).toBe(0);
  });

  it("two chores on the same day count once toward a consecutive-day streak", async () => {
    const { family, ctx } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id);
    const task2 = await createTaskFixture(db, family.id, { title: "Teeth" });
    const streak = await createGoal(db, ctx, {
      familyId: family.id,
      title: "3-day streak",
      type: "CONSECUTIVE_DAYS",
      targetCount: 3,
      recurrence: "NONE",
      rewardPoints: 0,
    });
    await assignGoal(db, ctx, {
      familyId: family.id,
      goalId: streak.id,
      childIds: [child.id],
      startDate: "2026-11-01",
    });

    await approveOn({ family, ctx, childId: child.id, taskId: task.id, localDate: "2026-11-10" });
    await approveOn({ family, ctx, childId: child.id, taskId: task2.id, localDate: "2026-11-10" });
    let assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: streak.id } });
    expect(assignment.currentStreak).toBe(1);
    expect(assignment.progressCount).toBe(1);
    expect(
      await db.goalContribution.count({
        where: { goalAssignmentId: assignment.id, countedForStreak: true },
      }),
    ).toBe(1);

    await approveOn({ family, ctx, childId: child.id, taskId: task.id, localDate: "2026-11-11" });
    await approveOn({ family, ctx, childId: child.id, taskId: task.id, localDate: "2026-11-12" });
    assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: streak.id } });
    expect(assignment.currentStreak).toBe(3);
    expect(assignment.status).toBe("COMPLETED");
  });

  it("the streak-day partial unique index blocks a second streak contribution on one day", async () => {
    const { family, ctx } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id);
    const streak = await createGoal(db, ctx, {
      familyId: family.id,
      title: "s",
      type: "CONSECUTIVE_DAYS",
      targetCount: 9,
      recurrence: "NONE",
      rewardPoints: 0,
    });
    const [assignment] = await assignGoal(db, ctx, {
      familyId: family.id,
      goalId: streak.id,
      childIds: [child.id],
      startDate: "2026-11-01",
    });
    await approveOn({ family, ctx, childId: child.id, taskId: task.id, localDate: "2026-11-10" });
    const other = await approveOn({
      family,
      ctx,
      childId: child.id,
      taskId: task.id,
      localDate: "2026-11-11",
    });
    // Remove the pipeline's own contribution for the second completion so the insert below can only
    // collide with the per-day streak index, not the (goalAssignmentId, completionId) unique key.
    await db.goalContribution.deleteMany({
      where: { goalAssignmentId: assignment.id, completionId: other.completionId! },
    });
    const sameDay = {
      familyId: family.id,
      goalAssignmentId: assignment.id,
      completionId: other.completionId!,
      localDate: new Date("2026-11-10T00:00:00Z"),
    };
    await expect(
      db.goalContribution.create({ data: { ...sameDay, countedForStreak: true } }),
    ).rejects.toThrow(/goal_contribution_streak_day_uq|Unique constraint/);
    // A same-day contribution that does not advance the streak is allowed.
    await expect(
      db.goalContribution.create({ data: { ...sameDay, countedForStreak: false } }),
    ).resolves.toMatchObject({ countedForStreak: false });
  });

  it("weekly goals use household-local dates: a late-night UTC completion lands in the right week", async () => {
    // Family in Los Angeles, week starts Monday. 2026-11-16 00:30 UTC is still Sunday 2026-11-15 in LA.
    const { family, ctx } = await createFamilyFixture(db, {
      timezone: "America/Los_Angeles",
      weekStartsOn: 1,
    });
    const { child } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id);
    const weekly = await createGoal(db, ctx, {
      familyId: family.id,
      title: "2 this week",
      type: "WEEKLY_COUNT",
      targetCount: 2,
      recurrence: "WEEKLY",
      rewardPoints: 0,
    });
    await assignGoal(db, ctx, {
      familyId: family.id,
      goalId: weekly.id,
      childIds: [child.id],
      startDate: "2026-11-11",
    });
    const first = await db.goalAssignment.findFirstOrThrow({ where: { goalId: weekly.id } });
    expect(first.periodKey).toBe("week:2026-11-09");

    // Occurrence local date is what the family sees (Sunday 15th), regardless of the UTC approval instant.
    await approveOn({ family, ctx, childId: child.id, taskId: task.id, localDate: "2026-11-15" });
    let assignment = await db.goalAssignment.findFirstOrThrow({
      where: { goalId: weekly.id, periodKey: "week:2026-11-09" },
    });
    expect(assignment.progressCount).toBe(1);

    // Next local day (Monday 16th) rolls the recurring goal into a new period automatically.
    await approveOn({ family, ctx, childId: child.id, taskId: task.id, localDate: "2026-11-16" });
    assignment = await db.goalAssignment.findFirstOrThrow({
      where: { goalId: weekly.id, periodKey: "week:2026-11-09" },
    });
    expect(assignment.progressCount).toBe(1);
    const next = await db.goalAssignment.findFirstOrThrow({
      where: { goalId: weekly.id, periodKey: "week:2026-11-16" },
    });
    expect(next.progressCount).toBe(1);
  });
});
