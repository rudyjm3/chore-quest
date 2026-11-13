import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { removeRoutineStepAndSettle, reviewRoutineRun } from "@/server/services/approval.service";
import {
  addRoutineStep,
  assignRoutine,
  completeRoutineStep,
  createRoutine,
  ensureRoutineRuns,
  removeRoutineStep,
  setRoutineStepOptional,
} from "@/server/services/routine.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture, createTaskFixture } from "../helpers/fixtures";

const db: PrismaClient = testDb();
const DAY = "2026-11-10"; // EST
const NEXT = "2026-11-11";

beforeEach(async () => {
  await resetHouseholdData(db);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-10T15:00:00Z")); // 10:00 NY on DAY
});
afterEach(() => vi.useRealTimers());
afterAll(() => disconnectTestDb());

async function setup(approvalPolicy: "PARENT_REVIEW" | "AUTO_APPROVE" = "PARENT_REVIEW") {
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
    taskIds: [tasks[0].id, tasks[1].id],
  });
  await assignRoutine(db, f.ctx, {
    familyId: f.family.id,
    routineId: routine.id,
    childId: child.id,
    bonusPoints: 3,
    approvalPolicy,
    schedule: { frequency: "DAILY", daysOfWeek: [], startDate: DAY },
  });
  await ensureRoutineRuns(db, { familyId: f.family.id, from: DAY, to: NEXT });
  const runs = await db.routineRun.findMany({
    where: { childId: child.id },
    orderBy: { localDate: "asc" },
  });
  const [today, tomorrow] = runs;
  return { ...f, child, childCtx, tasks, routine, steps: routine.steps, today, tomorrow };
}

type Setup = Awaited<ReturnType<typeof setup>>;
const progressOf = (runId: string) =>
  db.routineStepProgress.findMany({ where: { runId }, include: { step: true } });
const runOf = (id: string) => db.routineRun.findUniqueOrThrow({ where: { id } });
const add = (s: Setup, taskIdx = 2, isOptional = false) =>
  addRoutineStep(db, s.ctx, { routineId: s.routine.id, taskId: s.tasks[taskIdx].id, isOptional });
const remove = (s: Setup, stepIdx: number) =>
  removeRoutineStep(db, s.ctx, { routineId: s.routine.id, stepId: s.steps[stepIdx].id });

describe("adding a step (ADR 0011)", () => {
  it("adds a PENDING row to today's and future unfinished runs, and appends the order", async () => {
    const s = await setup();
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id); // in progress
    const { step, runsUpdated } = await add(s);
    expect(runsUpdated).toBe(2);
    expect(step.sortOrder).toBe(3);
    for (const run of [s.today, s.tomorrow]) {
      const row = (await progressOf(run.id)).find((p) => p.stepId === step.id);
      expect(row?.status).toBe("PENDING");
    }
    // The in-progress run now also needs the new step before it submits.
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[1].id);
    expect((await runOf(s.today.id)).status).toBe("IN_PROGRESS");
    await completeRoutineStep(db, s.childCtx, s.today.id, step.id);
    expect((await runOf(s.today.id)).status).toBe("SUBMITTED");
  });

  it("an optional step does not block submission", async () => {
    const s = await setup();
    const { step } = await add(s, 2, true);
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[1].id);
    expect((await runOf(s.today.id)).status).toBe("SUBMITTED");
    expect((await progressOf(s.today.id)).find((p) => p.stepId === step.id)?.status).toBe(
      "PENDING",
    );
  });

  it("leaves a submitted run (and its pending review) untouched", async () => {
    const s = await setup();
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[1].id);
    const before = await runOf(s.today.id);
    const { step } = await add(s);
    const after = await runOf(s.today.id);
    expect(after.status).toBe("SUBMITTED");
    expect(after.submittedAt?.getTime()).toBe(before.submittedAt?.getTime());
    expect((await progressOf(s.today.id)).some((p) => p.stepId === step.id)).toBe(false);
    // The parent can still approve it.
    const out = await reviewRoutineRun(db, s.ctx, {
      familyId: s.family.id,
      runId: s.today.id,
      decision: "APPROVED",
    });
    expect(out.decision).toBe("APPROVED");
    // Tomorrow's run did get the step.
    expect((await progressOf(s.tomorrow.id)).some((p) => p.stepId === step.id)).toBe(true);
  });

  it("does not change an approved run or write to past runs", async () => {
    const s = await setup();
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[1].id);
    await reviewRoutineRun(db, s.ctx, {
      familyId: s.family.id,
      runId: s.today.id,
      decision: "APPROVED",
    });
    // A run on a past, unfinished day is effectively missed and not reconciled.
    vi.setSystemTime(new Date("2026-11-11T15:00:00Z"));
    const { step } = await add(s);
    expect((await runOf(s.today.id)).status).toBe("APPROVED");
    expect((await progressOf(s.today.id)).some((p) => p.stepId === step.id)).toBe(false);
    expect((await progressOf(s.tomorrow.id)).some((p) => p.stepId === step.id)).toBe(true);
  });

  it("a rejected (reopened) run gets the new step", async () => {
    const s = await setup();
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[1].id);
    await reviewRoutineRun(db, s.ctx, {
      familyId: s.family.id,
      runId: s.today.id,
      decision: "REJECTED",
    });
    const { step } = await add(s);
    expect((await progressOf(s.today.id)).some((p) => p.stepId === step.id)).toBe(true);
  });

  it("runs materialized later include the new step and not retired ones", async () => {
    const s = await setup();
    const { step } = await add(s);
    await remove(s, 0);
    await ensureRoutineRuns(db, { familyId: s.family.id, from: "2026-11-12", to: "2026-11-12" });
    const later = await db.routineRun.findFirstOrThrow({
      where: { localDate: new Date("2026-11-12") },
    });
    const ids = (await progressOf(later.id)).map((p) => p.stepId).sort();
    expect(ids).toEqual([s.steps[1].id, step.id].sort());
  });

  it("rejects duplicates, foreign/archived tasks, archived routines and optional-only routines", async () => {
    const s = await setup();
    await expect(add(s, 0)).rejects.toMatchObject({ code: "INVALID_STATE" });
    const other = await createFamilyFixture(db);
    const foreign = await createTaskFixture(db, other.family.id);
    await expect(
      addRoutineStep(db, s.ctx, { routineId: s.routine.id, taskId: foreign.id, isOptional: false }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    await db.task.update({ where: { id: s.tasks[2].id }, data: { isArchived: true } });
    await expect(add(s)).rejects.toMatchObject({ code: "VALIDATION" });
    await expect(
      addRoutineStep(db, other.ctx, {
        routineId: s.routine.id,
        taskId: s.tasks[2].id,
        isOptional: false,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await db.routine.update({ where: { id: s.routine.id }, data: { isArchived: true } });
    await expect(add(s)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("removing a step (ADR 0011)", () => {
  it("retires the step, keeps its progress rows, and lets the task be re-added as a new step", async () => {
    const s = await setup();
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
    await add(s); // keep >= 1 required after the removal below
    await remove(s, 0);
    const retired = await db.routineStep.findUniqueOrThrow({ where: { id: s.steps[0].id } });
    expect(retired.retiredAt).not.toBeNull();
    const rows = await progressOf(s.today.id);
    expect(rows.find((p) => p.stepId === s.steps[0].id)?.status).toBe("DONE"); // history kept
    await expect(
      completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const again = await addRoutineStep(db, s.ctx, {
      routineId: s.routine.id,
      taskId: s.tasks[0].id,
      isOptional: false,
    });
    expect(again.step.id).not.toBe(s.steps[0].id);
  });

  it("submits an in-progress run whose remaining required steps are done (parents notified)", async () => {
    const s = await setup();
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
    const out = await remove(s, 1);
    expect(out.submitted.map((r) => r.runId)).toEqual([s.today.id]);
    const run = await runOf(s.today.id);
    expect(run.status).toBe("SUBMITTED");
    expect(run.submittedAt).not.toBeNull();
    const notes = await db.notification.count({
      where: { familyId: s.family.id, entityId: s.today.id, kind: "SUBMISSION_PENDING" },
    });
    expect(notes).toBeGreaterThan(0);
    // Untouched tomorrow run stays open.
    expect((await runOf(s.tomorrow.id)).status).toBe("PENDING");
  });

  it("AUTO_APPROVE runs completed by a removal are approved and processed", async () => {
    const s = await setup("AUTO_APPROVE");
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
    const out = await removeRoutineStepAndSettle(db, s.ctx, {
      routineId: s.routine.id,
      stepId: s.steps[1].id,
    });
    expect(out.autoApproved).toBe(1);
    expect((await runOf(s.today.id)).status).toBe("APPROVED");
    expect(await db.activityCompletion.count({ where: { routineRunId: s.today.id } })).toBe(1);
  });

  it("does not touch submitted or approved runs", async () => {
    const s = await setup();
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[1].id);
    await remove(s, 1);
    const run = await runOf(s.today.id);
    expect(run.status).toBe("SUBMITTED");
    expect((await progressOf(s.today.id)).map((p) => p.status)).toEqual(["DONE", "DONE"]);
    await reviewRoutineRun(db, s.ctx, {
      familyId: s.family.id,
      runId: s.today.id,
      decision: "APPROVED",
    });
    expect((await runOf(s.today.id)).status).toBe("APPROVED");
  });

  it("refuses to remove the last required step, but allows an optional one", async () => {
    const s = await setup();
    await remove(s, 1);
    await expect(remove(s, 0)).rejects.toMatchObject({ code: "INVALID_STATE" });
    await add(s, 2, true);
    await expect(remove(s, 0)).rejects.toMatchObject({ code: "INVALID_STATE" });
    const optional = await db.routineStep.findFirstOrThrow({
      where: { routineId: s.routine.id, isOptional: true, retiredAt: null },
    });
    await expect(
      removeRoutineStep(db, s.ctx, { routineId: s.routine.id, stepId: optional.id }),
    ).resolves.toBeTruthy();
    // Retired steps cannot be removed again or made optional.
    await expect(remove(s, 1)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      setRoutineStepOptional(db, s.ctx, s.routine.id, s.steps[1].id, true),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("is family scoped", async () => {
    const s = await setup();
    const other = await createFamilyFixture(db);
    await expect(
      removeRoutineStep(db, other.ctx, { routineId: s.routine.id, stepId: s.steps[0].id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("writes audit entries for add and remove", async () => {
    const s = await setup();
    await add(s);
    await remove(s, 0);
    const actions = (
      await db.auditLog.findMany({
        where: { familyId: s.family.id, action: { startsWith: "routine.step." } },
      })
    ).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["routine.step.add", "routine.step.remove"]));
  });
});

describe("constraints (violating input)", () => {
  it("rejects two active steps with the same order or task, but allows them once one is retired", async () => {
    const s = await setup();
    await expect(
      db.routineStep.create({
        data: { routineId: s.routine.id, taskId: s.tasks[2].id, sortOrder: 1 },
      }),
    ).rejects.toThrow();
    await expect(
      db.routineStep.create({
        data: { routineId: s.routine.id, taskId: s.tasks[0].id, sortOrder: 9 },
      }),
    ).rejects.toThrow();
    await add(s); // so step 0 can be retired
    await remove(s, 0);
    await expect(
      db.routineStep.create({
        data: { routineId: s.routine.id, taskId: s.tasks[0].id, sortOrder: 1 },
      }),
    ).resolves.toBeTruthy();
  });
});

describe("edit versus tick concurrency", () => {
  it("a tick racing an add never leaves a run submitted with a missing required row", async () => {
    for (let round = 0; round < 6; round++) {
      await resetHouseholdData(db);
      const s = await setup();
      await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
      await Promise.allSettled([
        completeRoutineStep(db, s.childCtx, s.today.id, s.steps[1].id),
        add(s),
      ]);
      const rows = await progressOf(s.today.id);
      const run = await runOf(s.today.id);
      const requiredActive = rows.filter((p) => !p.step.retiredAt && !p.step.isOptional);
      if (run.status === "SUBMITTED") {
        // Either the tick won (finished before the add, so no new row) or the add won and the
        // child had to do the new step: never a submitted run with an unfinished required row.
        expect(requiredActive.every((p) => p.status === "DONE")).toBe(true);
      } else {
        expect(rows.some((p) => p.status === "PENDING" && !p.step.isOptional)).toBe(true);
      }
    }
  });

  it("a tick racing a removal ends consistent (looped)", async () => {
    for (let round = 0; round < 6; round++) {
      await resetHouseholdData(db);
      const s = await setup();
      await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
      await Promise.allSettled([
        completeRoutineStep(db, s.childCtx, s.today.id, s.steps[1].id),
        remove(s, 1),
      ]);
      const run = await runOf(s.today.id);
      // Whichever order they serialized in, step 0 is done and step 1 is retired or done.
      expect(run.status).toBe("SUBMITTED");
    }
  });

  it("deterministic: an edit holding the routine lock blocks a tick until it commits", async () => {
    const s = await setup();
    await completeRoutineStep(db, s.childCtx, s.today.id, s.steps[0].id);
    let tickSettled = false;
    let tick: Promise<unknown> = Promise.resolve();
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "routine_run" WHERE id = ${s.today.id}::uuid FOR UPDATE`;
      tick = completeRoutineStep(db, s.childCtx, s.today.id, s.steps[1].id).finally(() => {
        tickSettled = true;
      });
      await new Promise((r) => setTimeout(r, 300));
      expect(tickSettled).toBe(false);
      // Edit under the held lock: add a required step the tick must now also respect.
      const step = await tx.routineStep.create({
        data: { routineId: s.routine.id, taskId: s.tasks[2].id, sortOrder: 3 },
      });
      await tx.routineStepProgress.create({ data: { runId: s.today.id, stepId: step.id } });
    });
    await tick;
    expect((await runOf(s.today.id)).status).toBe("IN_PROGRESS");
  });
});
