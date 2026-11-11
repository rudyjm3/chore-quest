import type { Prisma } from "@/generated/prisma/client";
import type { ApprovalPolicy } from "@/generated/prisma/enums";
import { pointsForOccurrence, pointsForRoutineRun } from "@/features/rewards/calculations";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type { ChildContext, ParentContext } from "@/server/policies/context";
import { assertFamilyScope, assertPermission } from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";
import { completeRoutineStep } from "./routine.service";
import { processCompletion, type ProcessResult } from "./progression.service";

type Tx = Prisma.TransactionClient;

/** The approval policy that applies to an occurrence: assignment override → task → family default. */
export function resolveApprovalPolicy(
  assignmentOverride: ApprovalPolicy | null,
  taskPolicy: ApprovalPolicy,
  familyDefault: ApprovalPolicy,
): ApprovalPolicy {
  if (assignmentOverride) return assignmentOverride;
  if (taskPolicy === "AUTO_APPROVE") return "AUTO_APPROVE";
  return familyDefault === "AUTO_APPROVE" ? "AUTO_APPROVE" : "PARENT_REVIEW";
}

export interface ReviewOutcome {
  occurrenceId: string;
  decision: "APPROVED" | "REJECTED";
  /** Present for approvals; false if the occurrence was already approved earlier. */
  completionId?: string;
  alreadyApproved: boolean;
  processing?: ProcessResult;
}

// ---------------------------------------------------------------------------
// Child submission
// ---------------------------------------------------------------------------

/**
 * Child marks an occurrence as done. If the effective policy is AUTO_APPROVE
 * the occurrence is approved in the same request (reviewer = system).
 */
export async function submitOccurrence(
  db: DbClient,
  ctx: ChildContext,
  occurrenceId: string,
  note?: string,
) {
  const result = await db.$transaction(async (tx) => {
    const occurrence = await lockOccurrence(tx, occurrenceId);
    if (!occurrence || occurrence.childId !== ctx.childId || occurrence.familyId !== ctx.familyId) {
      throw AppError.notFound("Chore");
    }
    if (occurrence.status === "APPROVED")
      throw AppError.invalidState("This chore is already approved");
    if (occurrence.status === "SUBMITTED")
      throw AppError.invalidState("Already waiting for a parent to check it");
    if (occurrence.status === "SKIPPED") throw AppError.invalidState("This chore was skipped");

    const existing = await tx.taskSubmission.findUnique({ where: { occurrenceId } });
    const submission = existing
      ? await tx.taskSubmission.update({
          where: { id: existing.id },
          data: {
            status: "PENDING",
            note,
            submittedAt: new Date(),
            attempt: { increment: 1 },
            review: { delete: true },
          },
        })
      : await tx.taskSubmission.create({
          data: { familyId: ctx.familyId, occurrenceId, childId: ctx.childId, note },
        });
    await tx.taskOccurrence.update({
      where: { id: occurrenceId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    const settings = await tx.familySettings.findUnique({ where: { familyId: ctx.familyId } });
    const policy = resolveApprovalPolicy(
      occurrence.assignment.approvalPolicyOverride,
      occurrence.assignment.task.approvalPolicy,
      settings?.defaultApprovalPolicy ?? "PARENT_REVIEW",
    );
    if (policy === "AUTO_APPROVE") {
      const approved = await approveOccurrenceTx(tx, {
        occurrenceId,
        reviewerUserId: null,
        isAutomatic: true,
      });
      return { submission, policy, approved };
    }
    return { submission, policy, approved: null };
  });

  const processing = result.approved?.completionId
    ? await processCompletion(db, result.approved.completionId)
    : undefined;
  return { ...result, processing };
}

// ---------------------------------------------------------------------------
// Parent review
// ---------------------------------------------------------------------------

export async function reviewOccurrence(
  db: DbClient,
  ctx: ParentContext,
  input: {
    familyId: string;
    occurrenceId: string;
    decision: "APPROVED" | "REJECTED";
    note?: string;
  },
): Promise<ReviewOutcome> {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canApprove");

  const outcome = await db.$transaction(async (tx) => {
    const occurrence = await lockOccurrence(tx, input.occurrenceId);
    if (!occurrence || occurrence.familyId !== ctx.familyId) throw AppError.notFound("Chore");

    if (input.decision === "REJECTED") {
      if (occurrence.status === "APPROVED")
        throw AppError.invalidState("Already approved; use an adjustment instead");
      const submission = await tx.taskSubmission.findUnique({
        where: { occurrenceId: occurrence.id },
      });
      if (submission) {
        await tx.taskSubmission.update({
          where: { id: submission.id },
          data: { status: "REJECTED" },
        });
        await tx.parentReview.upsert({
          where: { submissionId: submission.id },
          create: {
            familyId: ctx.familyId,
            submissionId: submission.id,
            reviewerUserId: ctx.userId,
            decision: "REJECTED",
            note: input.note,
          },
          update: {
            reviewerUserId: ctx.userId,
            decision: "REJECTED",
            note: input.note,
            reviewedAt: new Date(),
          },
        });
      }
      await tx.taskOccurrence.update({
        where: { id: occurrence.id },
        data: { status: "REJECTED", reviewedAt: new Date() },
      });
      await recordAudit(tx, {
        familyId: ctx.familyId,
        actorType: "PARENT",
        actorUserId: ctx.userId,
        action: "approval.reject",
        entityType: "TaskOccurrence",
        entityId: occurrence.id,
        metadata: { note: input.note },
      });
      return { occurrenceId: occurrence.id, decision: "REJECTED" as const, alreadyApproved: false };
    }

    const approved = await approveOccurrenceTx(tx, {
      occurrenceId: occurrence.id,
      reviewerUserId: ctx.userId,
      isAutomatic: false,
      note: input.note,
    });
    return {
      occurrenceId: occurrence.id,
      decision: "APPROVED" as const,
      completionId: approved.completionId,
      alreadyApproved: approved.alreadyApproved,
    };
  });

  if (outcome.decision === "APPROVED" && outcome.completionId) {
    const processing = await processCompletion(db, outcome.completionId);
    return { ...outcome, processing };
  }
  return outcome;
}

/**
 * Core approval step. Must run with the occurrence row locked. Idempotent:
 * approving an already-approved occurrence returns the existing completion.
 */
async function approveOccurrenceTx(
  tx: Tx,
  params: {
    occurrenceId: string;
    reviewerUserId: string | null;
    isAutomatic: boolean;
    note?: string;
  },
) {
  const occurrence = await tx.taskOccurrence.findUniqueOrThrow({
    where: { id: params.occurrenceId },
    include: { assignment: { include: { task: true } }, completion: true },
  });
  if (occurrence.status === "APPROVED" && occurrence.completion) {
    return { completionId: occurrence.completion.id, alreadyApproved: true };
  }
  if (occurrence.status === "SKIPPED") throw AppError.invalidState("This chore was skipped");

  // A parent may approve directly (child never submitted); create the submission on their behalf.
  const submission =
    (await tx.taskSubmission.findUnique({ where: { occurrenceId: occurrence.id } })) ??
    (await tx.taskSubmission.create({
      data: {
        familyId: occurrence.familyId,
        occurrenceId: occurrence.id,
        childId: occurrence.childId,
        note: params.isAutomatic ? undefined : "Marked complete by parent",
      },
    }));

  await tx.taskSubmission.update({ where: { id: submission.id }, data: { status: "APPROVED" } });
  await tx.parentReview.upsert({
    where: { submissionId: submission.id },
    create: {
      familyId: occurrence.familyId,
      submissionId: submission.id,
      reviewerUserId: params.reviewerUserId,
      decision: "APPROVED",
      isAutomatic: params.isAutomatic,
      note: params.note,
    },
    update: {
      reviewerUserId: params.reviewerUserId,
      decision: "APPROVED",
      isAutomatic: params.isAutomatic,
      note: params.note,
      reviewedAt: new Date(),
    },
  });
  const now = new Date();
  await tx.taskOccurrence.update({
    where: { id: occurrence.id },
    data: { status: "APPROVED", reviewedAt: now },
  });
  const completion = await tx.activityCompletion.create({
    data: {
      familyId: occurrence.familyId,
      childId: occurrence.childId,
      sourceType: "TASK_OCCURRENCE",
      taskOccurrenceId: occurrence.id,
      localDate: occurrence.localDate,
      completedAt: submission.submittedAt ?? now,
      approvedAt: now,
      approvedByUserId: params.reviewerUserId,
      pointsAwarded: pointsForOccurrence(occurrence.pointsSnapshot),
      taskId: occurrence.assignment.taskId,
      taskCategory: occurrence.assignment.task.category,
    },
  });
  await recordAudit(tx, {
    familyId: occurrence.familyId,
    actorType: params.isAutomatic ? "SYSTEM" : "PARENT",
    actorUserId: params.reviewerUserId,
    action: params.isAutomatic ? "approval.auto" : "approval.approve",
    entityType: "TaskOccurrence",
    entityId: occurrence.id,
    metadata: { completionId: completion.id, points: completion.pointsAwarded },
  });
  return { completionId: completion.id, alreadyApproved: false };
}

// ---------------------------------------------------------------------------
// Routine runs
// ---------------------------------------------------------------------------

export async function reviewRoutineRun(
  db: DbClient,
  ctx: ParentContext,
  input: { familyId: string; runId: string; decision: "APPROVED" | "REJECTED"; note?: string },
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canApprove");
  const outcome = await db.$transaction(async (tx) => {
    await lockRoutineRun(tx, input.runId);
    const run = await tx.routineRun.findFirst({
      where: { id: input.runId, familyId: ctx.familyId },
      select: { id: true, status: true },
    });
    if (!run) throw AppError.notFound("Routine run");
    if (input.decision === "REJECTED") {
      if (run.status === "APPROVED") throw AppError.invalidState("Already approved");
      // Reopen every step so the child can redo the routine and resubmit it.
      await tx.routineStepProgress.updateMany({
        where: { runId: run.id },
        data: { status: "PENDING", completedAt: null },
      });
      await tx.routineRun.update({
        where: { id: run.id },
        data: { status: "REJECTED", reviewedAt: new Date(), submittedAt: null },
      });
      await recordAudit(tx, {
        familyId: ctx.familyId,
        actorType: "PARENT",
        actorUserId: ctx.userId,
        action: "approval.routine.reject",
        entityType: "RoutineRun",
        entityId: run.id,
        metadata: { note: input.note },
      });
      return { runId: run.id, decision: "REJECTED" as const, alreadyApproved: false };
    }
    const approved = await approveRoutineRunTx(tx, {
      runId: run.id,
      reviewerUserId: ctx.userId,
      isAutomatic: false,
    });
    return { runId: run.id, decision: "APPROVED" as const, ...approved };
  });
  if (outcome.decision === "APPROVED" && outcome.completionId) {
    const processing = await processCompletion(db, outcome.completionId);
    return { ...outcome, processing };
  }
  return outcome;
}

/**
 * Child ticks one routine step. When the last required step is done and the assignment's
 * policy is AUTO_APPROVE, the run is approved by the system and processed immediately;
 * otherwise it waits in the parent's approval queue as SUBMITTED.
 */
export async function completeRoutineStepAndSubmit(
  db: DbClient,
  ctx: ChildContext,
  runId: string,
  stepId: string,
) {
  const step = await completeRoutineStep(db, ctx, runId, stepId);
  if (!step.allStepsDone || step.approvalPolicy !== "AUTO_APPROVE") {
    return { ...step, autoApproved: false as const };
  }
  const approved = await db.$transaction(async (tx) => {
    await lockRoutineRun(tx, runId);
    return approveRoutineRunTx(tx, { runId, reviewerUserId: null, isAutomatic: true });
  });
  const processing = await processCompletion(db, approved.completionId);
  return { ...step, autoApproved: true as const, completionId: approved.completionId, processing };
}

/**
 * Core routine-run approval. Must run with the run row locked. Idempotent: approving an
 * already-approved run returns its existing completion.
 */
async function approveRoutineRunTx(
  tx: Tx,
  params: { runId: string; reviewerUserId: string | null; isAutomatic: boolean },
) {
  const run = await tx.routineRun.findUniqueOrThrow({
    where: { id: params.runId },
    include: { assignment: true, completion: true },
  });
  if (run.status === "APPROVED" && run.completion) {
    return { completionId: run.completion.id, alreadyApproved: true };
  }
  const now = new Date();
  await tx.routineRun.update({
    where: { id: run.id },
    data: { status: "APPROVED", reviewedAt: now },
  });
  const completion = await tx.activityCompletion.create({
    data: {
      familyId: run.familyId,
      childId: run.childId,
      sourceType: "ROUTINE_RUN",
      routineRunId: run.id,
      localDate: run.localDate,
      completedAt: run.submittedAt ?? now,
      approvedAt: now,
      approvedByUserId: params.reviewerUserId,
      pointsAwarded: pointsForRoutineRun(run.bonusPointsSnapshot),
      routineId: run.assignment.routineId,
    },
  });
  await recordAudit(tx, {
    familyId: run.familyId,
    actorType: params.isAutomatic ? "SYSTEM" : "PARENT",
    actorUserId: params.reviewerUserId,
    action: params.isAutomatic ? "approval.routine.auto" : "approval.routine.approve",
    entityType: "RoutineRun",
    entityId: run.id,
    metadata: { completionId: completion.id },
  });
  return { completionId: completion.id, alreadyApproved: false };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function lockRoutineRun(tx: Tx, runId: string) {
  await tx.$queryRaw`SELECT id FROM "routine_run" WHERE id = ${runId}::uuid FOR UPDATE`;
}

async function lockOccurrence(tx: Tx, occurrenceId: string) {
  await tx.$queryRaw`SELECT id FROM "task_occurrence" WHERE id = ${occurrenceId}::uuid FOR UPDATE`;
  return tx.taskOccurrence.findUnique({
    where: { id: occurrenceId },
    include: { assignment: { include: { task: true } } },
  });
}
