import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { AppError } from "@/lib/errors";
import { reviewOccurrence, submitOccurrence } from "@/server/services/approval.service";
import { processCompletion } from "@/server/services/progression.service";
import { getWallets } from "@/server/services/reward.service";
import { ensureTaskOccurrences } from "@/server/services/task.service";

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

async function setup(points = 5) {
  const { family, ctx } = await createFamilyFixture(db);
  const { child, ctx: childCtx } = await createChildFixture(db, family.id);
  const task = await createTaskFixture(db, family.id, { points });
  const { occurrence, assignment } = await createOccurrenceFixture(db, {
    familyId: family.id,
    childId: child.id,
    taskId: task.id,
    localDate: "2026-11-10",
    points,
  });
  return { family, ctx, child, childCtx, task, occurrence, assignment };
}

describe("approval pipeline", () => {
  it("child submits, parent approves: completion + points ledger + wallet", async () => {
    const { ctx, childCtx, occurrence, family, child } = await setup(7);
    const submitted = await submitOccurrence(db, childCtx, occurrence.id, "Done!");
    expect(submitted.policy).toBe("PARENT_REVIEW");
    expect(submitted.approved).toBeNull();

    const outcome = await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });
    expect(outcome.decision).toBe("APPROVED");
    expect(outcome.alreadyApproved).toBe(false);
    expect(outcome.processing?.status).toBe("PROCESSED");

    const completion = await db.activityCompletion.findUniqueOrThrow({
      where: { taskOccurrenceId: occurrence.id },
    });
    expect(completion.pointsAwarded).toBe(7);
    expect(completion.processingStatus).toBe("PROCESSED");
    expect((await getWallets(db, child.id)).POINTS).toBe(7);
    expect(await db.rewardLedgerEntry.count({ where: { childId: child.id } })).toBe(1);
    expect(await db.auditLog.count({ where: { action: "approval.approve" } })).toBe(1);
  });

  it("approving the same chore twice awards points once", async () => {
    const { ctx, occurrence, family, child } = await setup(5);
    const first = await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });
    const second = await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });
    expect(second.alreadyApproved).toBe(true);
    expect(second.completionId).toBe(first.completionId);
    expect(second.processing?.status).toBe("ALREADY_PROCESSED");
    expect((await getWallets(db, child.id)).POINTS).toBe(5);
    expect(await db.activityCompletion.count({ where: { childId: child.id } })).toBe(1);
  });

  it("two concurrent approvals produce exactly one completion and one credit", async () => {
    const { ctx, occurrence, family, child } = await setup(5);
    const results = await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        reviewOccurrence(db, ctx, {
          familyId: family.id,
          occurrenceId: occurrence.id,
          decision: "APPROVED",
        }),
      ),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const fresh = results.filter((r) => r.status === "fulfilled" && !r.value.alreadyApproved);
    expect(fresh.length).toBe(1);
    expect(await db.activityCompletion.count({ where: { childId: child.id } })).toBe(1);
    expect(
      await db.rewardLedgerEntry.count({ where: { childId: child.id, currency: "POINTS" } }),
    ).toBe(1);
    expect((await getWallets(db, child.id)).POINTS).toBe(5);
  });

  it("re-running the pipeline for a processed completion changes nothing", async () => {
    const { ctx, occurrence, family, child } = await setup(5);
    const outcome = await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });
    await db.activityCompletion.update({
      where: { id: outcome.completionId! },
      data: { processingStatus: "PENDING" },
    });
    const again = await processCompletion(db, outcome.completionId!);
    expect(again.status).toBe("PROCESSED");
    expect((await getWallets(db, child.id)).POINTS).toBe(5);
    expect(await db.rewardLedgerEntry.count({ where: { childId: child.id } })).toBe(1);
  });

  it("child cannot submit an already-approved occurrence", async () => {
    const { ctx, childCtx, occurrence, family } = await setup();
    await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });
    await expect(submitOccurrence(db, childCtx, occurrence.id)).rejects.toThrow(/already approved/);
  });

  it("parent rejects; child resubmits; parent approves once", async () => {
    const { ctx, childCtx, occurrence, family, child } = await setup(5);
    await submitOccurrence(db, childCtx, occurrence.id);
    const rejected = await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "REJECTED",
      note: "Not tidy yet",
    });
    expect(rejected.decision).toBe("REJECTED");
    expect(
      (await db.taskOccurrence.findUniqueOrThrow({ where: { id: occurrence.id } })).status,
    ).toBe("REJECTED");
    expect((await getWallets(db, child.id)).POINTS).toBe(0);

    const resubmitted = await submitOccurrence(db, childCtx, occurrence.id, "Fixed it");
    expect(resubmitted.submission.attempt).toBe(2);
    await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrence.id,
      decision: "APPROVED",
    });
    expect((await getWallets(db, child.id)).POINTS).toBe(5);
    expect(await db.taskSubmission.count({ where: { occurrenceId: occurrence.id } })).toBe(1);
  });

  it("AUTO_APPROVE tasks are approved on submission with a system review", async () => {
    const { family, ctx: _ctx } = await createFamilyFixture(db);
    void _ctx;
    const { child, ctx: childCtx } = await createChildFixture(db, family.id);
    const task = await createTaskFixture(db, family.id, {
      approvalPolicy: "AUTO_APPROVE",
      points: 3,
    });
    const { occurrence } = await createOccurrenceFixture(db, {
      familyId: family.id,
      childId: child.id,
      taskId: task.id,
      localDate: "2026-11-10",
      points: 3,
    });
    const result = await submitOccurrence(db, childCtx, occurrence.id);
    expect(result.policy).toBe("AUTO_APPROVE");
    expect(result.processing?.status).toBe("PROCESSED");
    const review = await db.parentReview.findFirstOrThrow({
      where: { submission: { occurrenceId: occurrence.id } },
    });
    expect(review.isAutomatic).toBe(true);
    expect(review.reviewerUserId).toBeNull();
    expect((await getWallets(db, child.id)).POINTS).toBe(3);
  });

  it("a child cannot submit another child's chore", async () => {
    const { family, occurrence } = await setup();
    const { ctx: otherChild } = await createChildFixture(db, family.id, "Other");
    await expect(submitOccurrence(db, otherChild, occurrence.id)).rejects.toThrow(AppError);
  });

  it("editing points on a recurring task does not rewrite already-generated occurrences", async () => {
    const { family, child, task, ctx } = await setup(5);
    const assignment = await db.taskAssignment.findFirstOrThrow({ where: { childId: child.id } });
    await ensureTaskOccurrences(db, { familyId: family.id, from: "2026-11-10", to: "2026-11-12" });
    // The 2026-11-10 occurrence already existed (snapshot 5); 11 and 12 were generated at task points (5).
    await db.task.update({ where: { id: task.id }, data: { points: 20 } });
    await ensureTaskOccurrences(db, { familyId: family.id, from: "2026-11-10", to: "2026-11-13" });
    const occurrences = await db.taskOccurrence.findMany({
      where: { assignmentId: assignment.id },
      orderBy: { localDate: "asc" },
    });
    expect(occurrences.map((o) => o.pointsSnapshot)).toEqual([5, 5, 5, 20]);
    expect(occurrences.length).toBe(4);
    const approved = await reviewOccurrence(db, ctx, {
      familyId: family.id,
      occurrenceId: occurrences[0].id,
      decision: "APPROVED",
    });
    expect(approved.decision).toBe("APPROVED");
    expect((await getWallets(db, child.id)).POINTS).toBe(5);
  });
});
