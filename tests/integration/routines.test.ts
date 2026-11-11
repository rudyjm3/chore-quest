import { afterAll, beforeEach, describe, expect, it } from "vitest";

import type { PrismaClient } from "@/generated/prisma/client";
import { completeRoutineStepAndSubmit, reviewRoutineRun } from "@/server/services/approval.service";
import type { ChildContext, ParentContext } from "@/server/policies/context";
import { getWallets } from "@/server/services/reward.service";
import { assignRoutine, createRoutine, ensureRoutineRuns } from "@/server/services/routine.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture, createTaskFixture } from "../helpers/fixtures";

const db: PrismaClient = testDb();

beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

const DAY = "2026-11-10";

/** A two-step routine assigned to one child, with today's run materialized. */
async function setupRoutine(approvalPolicy: "PARENT_REVIEW" | "AUTO_APPROVE", bonusPoints = 7) {
  const { family, ctx } = await createFamilyFixture(db);
  const { child, ctx: childCtx } = await createChildFixture(db, family.id);
  const bed = await createTaskFixture(db, family.id, { title: "Make Bed" });
  const teeth = await createTaskFixture(db, family.id, { title: "Brush Teeth" });
  const routine = await createRoutine(db, ctx, {
    familyId: family.id,
    name: "Morning",
    taskIds: [bed.id, teeth.id],
  });
  await assignRoutine(db, ctx, {
    familyId: family.id,
    routineId: routine.id,
    childId: child.id,
    bonusPoints,
    approvalPolicy,
    schedule: { frequency: "DAILY", daysOfWeek: [], startDate: DAY },
  });
  await ensureRoutineRuns(db, { familyId: family.id, from: DAY, to: DAY });
  const run = await db.routineRun.findFirstOrThrow({ where: { childId: child.id } });
  const stepIds = routine.steps.map((s) => s.id);
  return { family, ctx, child, childCtx, run, stepIds };
}

async function completeAll(childCtx: ChildContext, runId: string, stepIds: string[]) {
  let last;
  for (const stepId of stepIds)
    last = await completeRoutineStepAndSubmit(db, childCtx, runId, stepId);
  return last;
}

describe("routine runs", () => {
  it("concurrent completion of the last two steps still submits the run", async () => {
    const { family, child, childCtx, stepIds } = await setupRoutine("PARENT_REVIEW");
    // Race the final two steps on many runs at once so an unserialized read is reliably exposed.
    await ensureRoutineRuns(db, { familyId: family.id, from: DAY, to: "2026-11-29" });
    const runs = await db.routineRun.findMany({ where: { childId: child.id } });
    expect(runs.length).toBe(20);
    await Promise.all(
      runs.flatMap((run) =>
        stepIds.map((stepId) => completeRoutineStepAndSubmit(db, childCtx, run.id, stepId)),
      ),
    );
    const fresh = await db.routineRun.findMany({
      where: { childId: child.id },
      include: { stepProgress: true },
    });
    for (const r of fresh) {
      expect(r.stepProgress.every((p) => p.status === "DONE")).toBe(true);
      expect(r.status).toBe("SUBMITTED");
    }
  });

  it("an AUTO_APPROVE routine is approved and processed when the last step is done", async () => {
    const { child, childCtx, run, stepIds } = await setupRoutine("AUTO_APPROVE", 7);
    const last = await completeAll(childCtx, run.id, stepIds);
    expect(last?.autoApproved).toBe(true);
    expect((await db.routineRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe(
      "APPROVED",
    );
    const completion = await db.activityCompletion.findUniqueOrThrow({
      where: { routineRunId: run.id },
    });
    expect(completion.approvedByUserId).toBeNull();
    expect(completion.processingStatus).toBe("PROCESSED");
    expect((await getWallets(db, child.id)).POINTS).toBe(7);
    expect(await db.auditLog.count({ where: { action: "approval.routine.auto" } })).toBe(1);
  });

  it("a PARENT_REVIEW routine waits for the parent", async () => {
    const { child, childCtx, run, stepIds } = await setupRoutine("PARENT_REVIEW");
    const last = await completeAll(childCtx, run.id, stepIds);
    expect(last?.autoApproved).toBe(false);
    expect((await db.routineRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe(
      "SUBMITTED",
    );
    expect(await db.activityCompletion.count({ where: { childId: child.id } })).toBe(0);
  });

  it("a rejected routine reopens its steps so the child can redo and resubmit it", async () => {
    const { family, ctx, child, childCtx, run, stepIds } = await setupRoutine("PARENT_REVIEW", 5);
    await completeAll(childCtx, run.id, stepIds);
    await reviewRoutineRun(db, ctx as ParentContext, {
      familyId: family.id,
      runId: run.id,
      decision: "REJECTED",
    });
    let fresh = await db.routineRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { stepProgress: true },
    });
    expect(fresh.status).toBe("REJECTED");
    expect(fresh.stepProgress.every((p) => p.status === "PENDING" && p.completedAt === null)).toBe(
      true,
    );

    await completeAll(childCtx, run.id, stepIds);
    fresh = await db.routineRun.findUniqueOrThrow({
      where: { id: run.id },
      include: { stepProgress: true },
    });
    expect(fresh.status).toBe("SUBMITTED");

    const approved = await reviewRoutineRun(db, ctx, {
      familyId: family.id,
      runId: run.id,
      decision: "APPROVED",
    });
    expect(approved.decision).toBe("APPROVED");
    expect((await getWallets(db, child.id)).POINTS).toBe(5);
  });
});
