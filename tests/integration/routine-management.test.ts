import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import {
  archiveRoutine,
  assignRoutine,
  completeRoutineStep,
  createRoutine,
  ensureRoutineRuns,
  listVisibleRunsForChild,
  moveRoutineStep,
  reorderRoutineSteps,
  setRoutineStepOptional,
  updateRoutineAssignment,
} from "@/server/services/routine.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture, createTaskFixture } from "../helpers/fixtures";

const db: PrismaClient = testDb();
beforeEach(() => resetHouseholdData(db));
afterEach(() => vi.useRealTimers());
afterAll(() => disconnectTestDb());

const DAY = "2026-11-10"; // EST, UTC-5

async function setup(window?: { windowStart: string; windowEnd: string }) {
  const f = await createFamilyFixture(db, { timezone: "America/New_York" });
  const { child, ctx: childCtx } = await createChildFixture(db, f.family.id);
  const tasks = [
    await createTaskFixture(db, f.family.id, { title: "A" }),
    await createTaskFixture(db, f.family.id, { title: "B" }),
    await createTaskFixture(db, f.family.id, { title: "C" }),
  ];
  const routine = await createRoutine(db, f.ctx, {
    familyId: f.family.id,
    name: "Morning",
    taskIds: tasks.map((t) => t.id),
  });
  const assignment = await assignRoutine(db, f.ctx, {
    familyId: f.family.id,
    routineId: routine.id,
    childId: child.id,
    bonusPoints: 3,
    approvalPolicy: "PARENT_REVIEW",
    schedule: { frequency: "DAILY", daysOfWeek: [], startDate: DAY },
    ...window,
  });
  await ensureRoutineRuns(db, { familyId: f.family.id, from: DAY, to: DAY });
  const run = await db.routineRun.findFirstOrThrow({ where: { childId: child.id } });
  return { ...f, child, childCtx, routine, assignment, run, steps: routine.steps };
}

const order = async (routineId: string) =>
  (await db.routineStep.findMany({ where: { routineId }, orderBy: { sortOrder: "asc" } })).map(
    (s) => s.id,
  );

describe("routine editing", () => {
  it("reorders steps (unique sortOrder survives) and rejects a non-permutation", async () => {
    const { ctx, routine, steps } = await setup();
    const [a, b, c] = steps.map((s) => s.id);
    await reorderRoutineSteps(db, ctx, routine.id, [c, a, b]);
    expect(await order(routine.id)).toEqual([c, a, b]);
    await moveRoutineStep(db, ctx, routine.id, b, "up");
    expect(await order(routine.id)).toEqual([c, b, a]);
    await moveRoutineStep(db, ctx, routine.id, c, "up"); // already first: no-op
    expect(await order(routine.id)).toEqual([c, b, a]);
    await expect(reorderRoutineSteps(db, ctx, routine.id, [a, b])).rejects.toThrow(/every step/i);
    await expect(reorderRoutineSteps(db, ctx, routine.id, [a, a, b])).rejects.toThrow(
      /every step/i,
    );
  });

  it("an optional step is not needed to finish; at least one step must stay required", async () => {
    const { ctx, childCtx, routine, steps, run } = await setup();
    const [a, b, c] = steps.map((s) => s.id);
    await setRoutineStepOptional(db, ctx, routine.id, c, true);
    await setRoutineStepOptional(db, ctx, routine.id, b, true);
    await expect(setRoutineStepOptional(db, ctx, routine.id, a, true)).rejects.toThrow(
      /at least one/i,
    );
    const result = await completeRoutineStep(db, childCtx, run.id, a);
    expect(result.allStepsDone).toBe(true);
    expect(result.run.status).toBe("SUBMITTED");
  });

  it("concurrent requests cannot leave a routine with no required step", async () => {
    const { ctx, routine, steps } = await setup();
    const [a, b, c] = steps.map((s) => s.id);
    await setRoutineStepOptional(db, ctx, routine.id, c, true);
    // Two required steps remain (a, b): making both optional at once must never both succeed.
    for (let round = 0; round < 10; round += 1) {
      await db.routineStep.updateMany({
        where: { id: { in: [a, b] } },
        data: { isOptional: false },
      });
      await Promise.allSettled([
        setRoutineStepOptional(db, ctx, routine.id, a, true),
        setRoutineStepOptional(db, ctx, routine.id, b, true),
      ]);
      const required = await db.routineStep.count({
        where: { routineId: routine.id, isOptional: false },
      });
      expect(required).toBeGreaterThanOrEqual(1);
    }
  });

  it("archived routines stop generating runs and cannot be assigned", async () => {
    const { ctx, family, child, routine } = await setup();
    await archiveRoutine(db, ctx, routine.id, true);
    expect(
      (await ensureRoutineRuns(db, { familyId: family.id, from: "2026-11-11", to: "2026-11-12" }))
        .created,
    ).toBe(0);
    await expect(
      assignRoutine(db, ctx, {
        familyId: family.id,
        routineId: routine.id,
        childId: child.id,
        bonusPoints: 0,
        approvalPolicy: "PARENT_REVIEW",
        schedule: { frequency: "DAILY", daysOfWeek: [], startDate: DAY },
      }),
    ).rejects.toThrow(/restore/i);
    await archiveRoutine(db, ctx, routine.id, false);
    expect(
      (await ensureRoutineRuns(db, { familyId: family.id, from: "2026-11-11", to: "2026-11-12" }))
        .created,
    ).toBe(2);
  });

  it("another family cannot edit the routine or its assignment", async () => {
    const a = await setup();
    const other = await createFamilyFixture(db);
    await expect(
      moveRoutineStep(db, other.ctx, a.routine.id, a.steps[0].id, "down"),
    ).rejects.toThrow(/not found/i);
    await expect(archiveRoutine(db, other.ctx, a.routine.id, true)).rejects.toThrow(/not found/i);
    await expect(
      updateRoutineAssignment(db, other.ctx, {
        familyId: other.family.id,
        assignmentId: a.assignment.id,
        schedule: { frequency: "DAILY", daysOfWeek: [], startDate: DAY },
        bonusPoints: 0,
        approvalPolicy: "PARENT_REVIEW",
      }),
    ).rejects.toThrow(/not found/i);
  });

  it("editing the bonus does not rewrite existing runs", async () => {
    const { ctx, family, assignment, run } = await setup();
    await updateRoutineAssignment(db, ctx, {
      familyId: family.id,
      assignmentId: assignment.id,
      schedule: { frequency: "DAILY", daysOfWeek: [], startDate: DAY },
      bonusPoints: 99,
      approvalPolicy: "PARENT_REVIEW",
    });
    expect(
      (await db.routineRun.findUniqueOrThrow({ where: { id: run.id } })).bonusPointsSnapshot,
    ).toBe(3);
  });
});

describe("overnight windows after local midnight", () => {
  it("keeps yesterday's unfinished run visible and completable until the window closes", async () => {
    const { family, child, childCtx, steps, run } = await setup({
      windowStart: "20:00",
      windowEnd: "06:00",
    });
    await ensureRoutineRuns(db, { familyId: family.id, from: "2026-11-11", to: "2026-11-11" });
    const base = { familyId: family.id, childId: child.id, timezone: "America/New_York" };
    // 02:00 NY on the 11th = 07:00Z
    const night = new Date("2026-11-11T07:00:00Z");
    const visible = await listVisibleRunsForChild(db, { ...base, today: "2026-11-11", now: night });
    expect(visible.map((r) => r.id)).toContain(run.id);
    expect(visible).toHaveLength(2);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(night);
    await expect(completeRoutineStep(db, childCtx, run.id, steps[0].id)).resolves.toBeTruthy();
    vi.useRealTimers();

    // 07:00 NY: the window closed, yesterday's run disappears.
    const morning = new Date("2026-11-11T12:00:00Z");
    const later = await listVisibleRunsForChild(db, { ...base, today: "2026-11-11", now: morning });
    expect(later.map((r) => r.id)).not.toContain(run.id);
    expect(later).toHaveLength(1);
  });

  it("does not resurface yesterday's run when it has no window", async () => {
    const { family, child, run } = await setup();
    await ensureRoutineRuns(db, { familyId: family.id, from: "2026-11-11", to: "2026-11-11" });
    const visible = await listVisibleRunsForChild(db, {
      familyId: family.id,
      childId: child.id,
      timezone: "America/New_York",
      today: "2026-11-11",
      now: new Date("2026-11-11T07:00:00Z"),
    });
    expect(visible.map((r) => r.id)).not.toContain(run.id);
  });
});

describe("completion window enforcement", () => {
  const win = { windowStart: "06:00", windowEnd: "09:00" };

  it("rejects before the window opens and after it closes, accepts inside", async () => {
    const { childCtx, run, steps } = await setup(win);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T10:00:00Z")); // 05:00 NY
    await expect(completeRoutineStep(db, childCtx, run.id, steps[0].id)).rejects.toThrow(
      /opens at 06:00/,
    );
    vi.setSystemTime(new Date("2026-11-10T14:30:00Z")); // 09:30 NY
    await expect(completeRoutineStep(db, childCtx, run.id, steps[0].id)).rejects.toThrow(
      /closed at 09:00/,
    );
    vi.setSystemTime(new Date("2026-11-10T12:00:00Z")); // 07:00 NY
    const res = await completeRoutineStep(db, childCtx, run.id, steps[0].id);
    expect(res.run.status).toBe("IN_PROGRESS");
    const progress = await db.routineStepProgress.findMany({
      where: { runId: run.id, status: "DONE" },
    });
    expect(progress).toHaveLength(1);
  });

  it("no window means any time", async () => {
    const { childCtx, run, steps } = await setup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-10T04:00:00Z"));
    await expect(completeRoutineStep(db, childCtx, run.id, steps[0].id)).resolves.toBeTruthy();
  });
});
