import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { localDateToDb } from "@/lib/utils/dates";
import { assignGoal, createGoal } from "@/server/services/goal.service";
import { runScheduledMaintenance } from "@/server/services/maintenance.service";
import { assignTask } from "@/server/services/task.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture, createTaskFixture } from "../helpers/fixtures";

const db: PrismaClient = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

// 2026-11-10 12:00 UTC is the same local day in New_York.
const NOW = new Date("2026-11-10T17:00:00Z");

describe("scheduled maintenance", () => {
  it("materializes 7 local days, idempotently, scoped per family", async () => {
    const a = await createFamilyFixture(db);
    const b = await createFamilyFixture(db, { timezone: "Pacific/Auckland" });
    for (const f of [a, b]) {
      const { child } = await createChildFixture(db, f.family.id);
      const task = await createTaskFixture(db, f.family.id);
      await assignTask(db, f.ctx, {
        familyId: f.family.id,
        taskId: task.id,
        childIds: [child.id],
        schedule: { frequency: "DAILY", daysOfWeek: [], startDate: "2026-11-01" },
      });
    }
    const first = await runScheduledMaintenance(db, { now: NOW });
    expect(first.occurrencesCreated).toBe(14);
    const second = await runScheduledMaintenance(db, { now: NOW });
    expect(second.occurrencesCreated).toBe(0);
    const aDates = await db.taskOccurrence.findMany({
      where: { familyId: a.family.id },
      orderBy: { localDate: "asc" },
    });
    expect(aDates).toHaveLength(7);
    expect(aDates[0].localDate.toISOString().slice(0, 10)).toBe("2026-11-10");
    // Auckland is already on the 11th when New York is on the 10th at 17:00Z.
    const bFirst = await db.taskOccurrence.findFirstOrThrow({
      where: { familyId: b.family.id },
      orderBy: { localDate: "asc" },
    });
    expect(bFirst.localDate.toISOString().slice(0, 10)).toBe("2026-11-11");
  });

  it("expires only ACTIVE goal assignments whose end date has passed", async () => {
    const { family, ctx } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const goal = await createGoal(db, ctx, {
      familyId: family.id,
      title: "G",
      type: "TOTAL_COUNT",
      targetCount: 3,
      recurrence: "NONE",
      rewardPoints: 0,
    });
    const [past] = await assignGoal(db, ctx, {
      familyId: family.id,
      goalId: goal.id,
      childIds: [child.id],
      startDate: "2026-10-01",
      endDate: "2026-11-09",
    });
    const goal2 = await createGoal(db, ctx, {
      familyId: family.id,
      title: "G2",
      type: "TOTAL_COUNT",
      targetCount: 3,
      recurrence: "NONE",
      rewardPoints: 0,
    });
    const [today] = await assignGoal(db, ctx, {
      familyId: family.id,
      goalId: goal2.id,
      childIds: [child.id],
      startDate: "2026-10-01",
      endDate: "2026-11-10",
    });
    const summary = await runScheduledMaintenance(db, { now: NOW });
    expect(summary.goalAssignmentsExpired).toBe(1);
    expect((await db.goalAssignment.findUniqueOrThrow({ where: { id: past.id } })).status).toBe(
      "EXPIRED",
    );
    expect((await db.goalAssignment.findUniqueOrThrow({ where: { id: today.id } })).status).toBe(
      "ACTIVE",
    );
    expect((await runScheduledMaintenance(db, { now: NOW })).goalAssignmentsExpired).toBe(0);
  });

  it("retries completions stuck in PENDING", async () => {
    const { family } = await createFamilyFixture(db);
    const { child } = await createChildFixture(db, family.id);
    const completion = await db.activityCompletion.create({
      data: {
        familyId: family.id,
        childId: child.id,
        sourceType: "TASK_OCCURRENCE",
        completedAt: NOW,
        localDate: localDateToDb("2026-11-10"),
        pointsAwarded: 5,
        taskCategory: "CHORE",
        taskOccurrenceId: (
          await db.taskOccurrence.create({
            data: {
              familyId: family.id,
              childId: child.id,
              localDate: localDateToDb("2026-11-10"),
              pointsSnapshot: 5,
              assignmentId: (
                await db.taskAssignment.create({
                  data: {
                    familyId: family.id,
                    childId: child.id,
                    taskId: (await createTaskFixture(db, family.id)).id,
                    startDate: localDateToDb("2026-11-10"),
                  },
                })
              ).id,
            },
          })
        ).id,
      },
    });
    const summary = await runScheduledMaintenance(db, { now: NOW });
    expect(summary.completionsReprocessed).toBeGreaterThanOrEqual(1);
    expect(
      (await db.activityCompletion.findUniqueOrThrow({ where: { id: completion.id } }))
        .processingStatus,
    ).toBe("PROCESSED");
  });
});
