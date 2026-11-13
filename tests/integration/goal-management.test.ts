import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { localDateToDb } from "@/lib/utils/dates";
import { reviewOccurrence } from "@/server/services/approval.service";
import {
  assignGoal,
  createGoal,
  repairGoalAssignment,
  repairGoalProgress,
  setGoalArchived,
  updateGoal,
  updateGoalAssignment,
} from "@/server/services/goal.service";
import { expireGoalAssignments } from "@/server/services/maintenance.service";
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

async function setup(goal: Partial<Parameters<typeof createGoal>[2]> = {}) {
  const { family, ctx } = await createFamilyFixture(db);
  const { child } = await createChildFixture(db, family.id);
  const task = await createTaskFixture(db, family.id);
  const created = await createGoal(db, ctx, {
    familyId: family.id,
    title: "Chores",
    type: "TOTAL_COUNT",
    targetCount: 5,
    recurrence: "NONE",
    rewardPoints: 20,
    ...goal,
  });
  await assignGoal(db, ctx, {
    familyId: family.id,
    goalId: created.id,
    childIds: [child.id],
    startDate: "2026-11-02",
    endDate: goal.type === "WEEKLY_COUNT" ? undefined : "2026-12-31",
  });
  return { family, ctx, child, task, goal: created };
}

async function approve(
  s: Awaited<ReturnType<typeof setup>>,
  localDate: string,
  taskId = s.task.id,
) {
  const { occurrence } = await createOccurrenceFixture(db, {
    familyId: s.family.id,
    childId: s.child.id,
    taskId,
    localDate,
  });
  return reviewOccurrence(db, s.ctx, {
    familyId: s.family.id,
    occurrenceId: occurrence.id,
    decision: "APPROVED",
  });
}

describe("goal editing", () => {
  it("lowering the target below progress completes the assignment and pays the reward once", async () => {
    const s = await setup();
    await approve(s, "2026-11-10");
    await approve(s, "2026-11-11");
    const before = (await getWallets(db, s.child.id)).POINTS; // 2 chores x 5

    await updateGoal(db, s.ctx, {
      familyId: s.family.id,
      goalId: s.goal.id,
      title: "Chores",
      targetCount: 2,
      rewardPoints: 20,
    });
    const assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: s.goal.id } });
    expect(assignment.status).toBe("COMPLETED");
    expect((await getWallets(db, s.child.id)).POINTS).toBe(before + 20);

    // Saving the same edit again is a no-op.
    await updateGoal(db, s.ctx, {
      familyId: s.family.id,
      goalId: s.goal.id,
      title: "Chores",
      targetCount: 2,
      rewardPoints: 20,
    });
    expect((await getWallets(db, s.child.id)).POINTS).toBe(before + 20);
    expect(await db.goalCompletion.count({ where: { goalAssignmentId: assignment.id } })).toBe(1);
  });

  it("raising the target keeps a completed assignment completed", async () => {
    const s = await setup({ targetCount: 1 });
    await approve(s, "2026-11-10");
    await updateGoal(db, s.ctx, {
      familyId: s.family.id,
      goalId: s.goal.id,
      title: "Chores",
      targetCount: 10,
      rewardPoints: 20,
    });
    const assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: s.goal.id } });
    expect(assignment.status).toBe("COMPLETED");
  });

  it("an archived goal stops counting new completions and can be restored", async () => {
    const s = await setup();
    await setGoalArchived(db, s.ctx, {
      familyId: s.family.id,
      goalId: s.goal.id,
      archived: true,
    });
    await approve(s, "2026-11-10");
    expect(await db.goalContribution.count()).toBe(0);

    await setGoalArchived(db, s.ctx, {
      familyId: s.family.id,
      goalId: s.goal.id,
      archived: false,
    });
    await approve(s, "2026-11-11");
    expect(await db.goalContribution.count()).toBe(1);
    expect(
      await db.auditLog.count({ where: { familyId: s.family.id, action: "goal.archive" } }),
    ).toBe(1);
  });

  it("a per-assignment target overrides the goal's target for that child only", async () => {
    const s = await setup({ targetCount: 5 });
    const assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: s.goal.id } });
    await updateGoalAssignment(db, s.ctx, {
      familyId: s.family.id,
      assignmentId: assignment.id,
      targetCount: 1,
      today: "2026-11-10",
    });
    await approve(s, "2026-11-10");
    const after = await db.goalAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after.status).toBe("COMPLETED");
    expect(after.targetOverride).toBe(1);
  });

  it("extending the end date of an expired assignment reactivates it", async () => {
    const s = await setup();
    const assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: s.goal.id } });
    await db.goalAssignment.update({
      where: { id: assignment.id },
      data: { endDate: localDateToDb("2026-11-05") },
    });
    expect(await expireGoalAssignments(db, s.family.id, "2026-11-10")).toBe(1);

    await updateGoalAssignment(db, s.ctx, {
      familyId: s.family.id,
      assignmentId: assignment.id,
      endDate: "2026-11-30",
      today: "2026-11-10",
    });
    const after = await db.goalAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after.status).toBe("ACTIVE");
    // A second expiry run leaves it alone while it is still in range.
    expect(await expireGoalAssignments(db, s.family.id, "2026-11-10")).toBe(0);
  });

  it("rejects an end date before the start date and edits of weekly dates", async () => {
    const s = await setup();
    const assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: s.goal.id } });
    await expect(
      updateGoalAssignment(db, s.ctx, {
        familyId: s.family.id,
        assignmentId: assignment.id,
        endDate: "2026-10-01",
        today: "2026-11-10",
      }),
    ).rejects.toThrow(/end date/);

    const weekly = await setup({ type: "WEEKLY_COUNT", recurrence: "WEEKLY", targetCount: 2 });
    const wa = await db.goalAssignment.findFirstOrThrow({ where: { goalId: weekly.goal.id } });
    await expect(
      updateGoalAssignment(db, weekly.ctx, {
        familyId: weekly.family.id,
        assignmentId: wa.id,
        endDate: "2026-12-01",
        today: "2026-11-10",
      }),
    ).rejects.toThrow(/calendar week/);
  });

  it("cannot edit another family's goal", async () => {
    const a = await setup();
    const b = await setup();
    await expect(
      updateGoal(db, b.ctx, {
        familyId: b.family.id,
        goalId: a.goal.id,
        title: "x",
        targetCount: 1,
        rewardPoints: 0,
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("expiry job and weekly rollover", () => {
  it("a weekly goal whose earlier week EXPIRED still rolls into the next week", async () => {
    const s = await setup({ type: "WEEKLY_COUNT", recurrence: "WEEKLY", targetCount: 2 });
    // Week of 2026-11-02 (Monday start) lapses.
    expect(await expireGoalAssignments(db, s.family.id, "2026-11-12")).toBe(1);
    await approve(s, "2026-11-12");
    const assignments = await db.goalAssignment.findMany({
      where: { goalId: s.goal.id },
      orderBy: { startDate: "asc" },
    });
    expect(assignments.map((a) => a.status)).toEqual(["EXPIRED", "ACTIVE"]);
    expect(assignments[1].progressCount).toBe(1);
    // Closed periods never take new contributions.
    expect(assignments[0].progressCount).toBe(0);
  });
});

describe("progress repair", () => {
  it("restores corrupted cached counters from contribution rows (count goal)", async () => {
    const s = await setup({ targetCount: 10, rewardPoints: 0 });
    for (const day of ["2026-11-10", "2026-11-11", "2026-11-12"]) await approve(s, day);
    const assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: s.goal.id } });
    expect(assignment.progressCount).toBe(3);

    await db.goalAssignment.update({
      where: { id: assignment.id },
      data: { progressCount: 99, bestStreak: 7, lastContributionDate: null },
    });
    const result = await repairGoalAssignment(db, s.family.id, assignment.id);
    expect(result.changed).toBe(true);
    const fixed = await db.goalAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(fixed.progressCount).toBe(3);
    expect(fixed.bestStreak).toBe(0);
    expect(fixed.lastContributionDate?.toISOString().slice(0, 10)).toBe("2026-11-12");

    // Idempotent: a second repair changes nothing.
    expect((await repairGoalAssignment(db, s.family.id, assignment.id)).changed).toBe(false);
  });

  it("restores streak counters, ignoring same-day repeats and out-of-order rows", async () => {
    const s = await setup({ type: "CONSECUTIVE_DAYS", targetCount: 10, rewardPoints: 0 });
    const task2 = await createTaskFixture(db, s.family.id, { title: "Teeth" });
    await approve(s, "2026-11-10");
    await approve(s, "2026-11-10", task2.id); // same day: contribution without streak credit
    await approve(s, "2026-11-11");
    await approve(s, "2026-11-12");
    await approve(s, "2026-11-08"); // out of order: no streak credit
    await approve(s, "2026-11-15"); // gap: streak restarts at 1
    const assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: s.goal.id } });
    const live = {
      progressCount: assignment.progressCount,
      currentStreak: assignment.currentStreak,
      bestStreak: assignment.bestStreak,
    };
    expect(live).toEqual({ progressCount: 1, currentStreak: 1, bestStreak: 3 });

    await db.goalAssignment.update({
      where: { id: assignment.id },
      data: { progressCount: 0, currentStreak: 42, bestStreak: 0, lastContributionDate: null },
    });
    const [result] = await repairGoalProgress(db, s.ctx, {
      familyId: s.family.id,
      goalId: s.goal.id,
    });
    expect(result.changed).toBe(true);
    const fixed = await db.goalAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect({
      progressCount: fixed.progressCount,
      currentStreak: fixed.currentStreak,
      bestStreak: fixed.bestStreak,
    }).toEqual(live);
    expect(
      await db.auditLog.count({ where: { familyId: s.family.id, action: "goal.repair" } }),
    ).toBe(1);
  });

  it("completes an active assignment whose replay reached the target, paying once", async () => {
    const s = await setup({ targetCount: 2, rewardPoints: 30 });
    await approve(s, "2026-11-10");
    // Simulate a crash between the contribution row and the status update: assignment still
    // ACTIVE with stale counters although two contributions exist.
    const assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: s.goal.id } });
    const { occurrence } = await createOccurrenceFixture(db, {
      familyId: s.family.id,
      childId: s.child.id,
      taskId: s.task.id,
      localDate: "2026-11-11",
    });
    const completion = await db.activityCompletion.create({
      data: {
        familyId: s.family.id,
        childId: s.child.id,
        sourceType: "TASK_OCCURRENCE",
        taskOccurrenceId: occurrence.id,
        localDate: localDateToDb("2026-11-11"),
        completedAt: new Date(),
      },
    });
    await db.goalContribution.create({
      data: {
        familyId: s.family.id,
        goalAssignmentId: assignment.id,
        completionId: completion.id,
        localDate: localDateToDb("2026-11-11"),
      },
    });
    const result = await repairGoalAssignment(db, s.family.id, assignment.id);
    expect(result.completedNow).toBe(true);
    const points = (await getWallets(db, s.child.id)).POINTS;
    await repairGoalAssignment(db, s.family.id, assignment.id);
    expect((await getWallets(db, s.child.id)).POINTS).toBe(points);
    expect(await db.goalCompletion.count({ where: { goalAssignmentId: assignment.id } })).toBe(1);
  });
});

describe("assignment edits versus concurrent approvals", () => {
  it("an edit that started before a completion cannot reopen or retarget the completed assignment", async () => {
    const s = await setup({ targetCount: 1, rewardPoints: 0 });
    const assignment = await db.goalAssignment.findFirstOrThrow({ where: { goalId: s.goal.id } });

    let edit: Promise<unknown> = Promise.resolve();
    // Hold the child lock like an in-flight approval, start the edit, then complete the
    // assignment before releasing the lock. The edit must re-check the status under the lock.
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "child" WHERE id = ${s.child.id}::uuid FOR UPDATE`;
      edit = updateGoalAssignment(db, s.ctx, {
        familyId: s.family.id,
        assignmentId: assignment.id,
        targetCount: 5,
        today: "2026-11-10",
      }).catch((error: unknown) => error);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await tx.goalAssignment.update({
        where: { id: assignment.id },
        data: { status: "COMPLETED", completedAt: new Date(), progressCount: 1 },
      });
    });
    const outcome = await edit;
    expect(outcome).toBeInstanceOf(Error);
    expect(String(outcome)).toMatch(/completed goal cannot be edited/);
    const after = await db.goalAssignment.findUniqueOrThrow({ where: { id: assignment.id } });
    expect(after).toMatchObject({ status: "COMPLETED", targetOverride: null });
  });
});
