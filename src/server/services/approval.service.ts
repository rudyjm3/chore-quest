import type { Prisma } from "@/generated/prisma/client";
import type { ApprovalPolicy } from "@/generated/prisma/enums";
import { pointsForOccurrence, pointsForRoutineRun } from "@/features/rewards/calculations";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type { ChildContext, ParentContext } from "@/server/policies/context";
import { assertFamilyScope, assertPermission } from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";
import { notifyChild, notifyParents } from "./notification.service";
import { completeRoutineStep, removeRoutineStep } from "./routine.service";
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
    await notifyParents(tx, ctx.familyId, {
      kind: "SUBMISSION_PENDING",
      title: `${ctx.childName} finished “${occurrence.assignment.task.title}”`,
      body: note ? `“${note}”` : undefined,
      entityType: "TaskOccurrence",
      entityId: occurrenceId,
      dedupeKey: `submission:${submission.id}:${submission.attempt}`,
    });
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
      await notifyChild(tx, ctx.familyId, occurrence.childId, {
        kind: "SUBMISSION_REJECTED",
        title: `Try “${occurrence.assignment.task.title}” again`,
        body: input.note,
        entityType: "TaskOccurrence",
        entityId: occurrence.id,
        dedupeKey: `review:${occurrence.id}:rejected:${submission?.attempt ?? 0}`,
      });
      return { occurrenceId: occurrence.id, decision: "REJECTED" as const, alreadyApproved: false };
    }

    const approved = await approveOccurrenceTx(tx, {
      occurrenceId: occurrence.id,
      reviewerUserId: ctx.userId,
      isAutomatic: false,
      note: input.note,
    });
    if (!approved.alreadyApproved) {
      await notifyChild(tx, ctx.familyId, occurrence.childId, {
        kind: "SUBMISSION_APPROVED",
        title: `“${occurrence.assignment.task.title}” was approved`,
        body: input.note,
        entityType: "TaskOccurrence",
        entityId: occurrence.id,
        dedupeKey: `review:${occurrence.id}:approved`,
      });
    }
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
// Bulk approval
// ---------------------------------------------------------------------------

export interface BulkApprovalItem {
  kind: "occurrence" | "routine_run";
  id: string;
}

export type BulkApprovalResult =
  | (BulkApprovalItem & { ok: true; alreadyApproved: boolean })
  | (BulkApprovalItem & { ok: false; code: string; message: string });

/**
 * Approve many items at once. Every item runs through the same single-item path
 * (`reviewOccurrence` / `reviewRoutineRun`), so each gets its own transaction, its
 * own audit entry and its own pipeline run. One failing item never rolls back the
 * others; the caller gets a per-item result. Re-sending the same batch is safe:
 * items that are already approved report `alreadyApproved`.
 */
export async function bulkApprove(
  db: DbClient,
  ctx: ParentContext,
  input: { familyId: string; items: BulkApprovalItem[]; note?: string },
): Promise<BulkApprovalResult[]> {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canApprove");
  if (input.items.length === 0) throw AppError.validation("Select at least one item");
  if (input.items.length > 50) throw AppError.validation("Approve at most 50 items at a time");

  const seen = new Set<string>();
  const results: BulkApprovalResult[] = [];
  for (const item of input.items) {
    const key = `${item.kind}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const outcome =
        item.kind === "occurrence"
          ? await reviewOccurrence(db, ctx, {
              familyId: input.familyId,
              occurrenceId: item.id,
              decision: "APPROVED",
              note: input.note,
            })
          : await reviewRoutineRun(db, ctx, {
              familyId: input.familyId,
              runId: item.id,
              decision: "APPROVED",
              note: input.note,
            });
      results.push({ ...item, ok: true, alreadyApproved: outcome.alreadyApproved });
    } catch (error) {
      if (error instanceof AppError) {
        results.push({ ...item, ok: false, code: error.code, message: error.message });
      } else {
        throw error;
      }
    }
  }
  return results;
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
  // Lock order is routine → run (ADR 0011), so a step edit cannot slip between a rejection and its reconcile.
  const pre = await db.routineRun.findFirst({
    where: { id: input.runId, familyId: ctx.familyId },
    select: { assignment: { select: { routineId: true } } },
  });
  const outcome = await db.$transaction(async (tx) => {
    if (pre) {
      await tx.$queryRaw`SELECT id FROM "routine" WHERE id = ${pre.assignment.routineId}::uuid FOR UPDATE`;
    }
    await lockRoutineRun(tx, input.runId);
    const run = await tx.routineRun.findFirst({
      where: { id: input.runId, familyId: ctx.familyId },
      select: {
        id: true,
        status: true,
        childId: true,
        submittedAt: true,
        assignment: { select: { routine: { select: { name: true } } } },
      },
    });
    if (!run) throw AppError.notFound("Routine run");
    if (input.decision === "REJECTED") {
      if (run.status === "APPROVED") throw AppError.invalidState("Already approved");
      // Reopen every step so the child can redo the routine and resubmit it.
      await tx.routineStepProgress.updateMany({
        where: { runId: run.id },
        data: { status: "PENDING", completedAt: null },
      });
      // The run is open again, so it follows the routine's current steps (ADR 0011): any active
      // step it was submitted without (added or re-created since) gets a PENDING row.
      const activeSteps = await tx.routineStep.findMany({
        where: {
          retiredAt: null,
          routine: { assignments: { some: { runs: { some: { id: run.id } } } } },
        },
        select: { id: true },
      });
      await tx.routineStepProgress.createMany({
        data: activeSteps.map((step) => ({ runId: run.id, stepId: step.id })),
        skipDuplicates: true,
      });
      await tx.routineRun.update({
        where: { id: run.id },
        data: {
          status: "REJECTED",
          reviewedAt: new Date(),
          submittedAt: null,
          reviewNote: input.note ?? null,
        },
      });
      await notifyChild(tx, ctx.familyId, run.childId, {
        kind: "SUBMISSION_REJECTED",
        title: `Try “${run.assignment.routine.name}” again`,
        body: input.note,
        entityType: "RoutineRun",
        entityId: run.id,
        dedupeKey: `review:${run.id}:rejected:${run.submittedAt?.toISOString() ?? "none"}`,
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
      note: input.note,
    });
    if (!approved.alreadyApproved) {
      await notifyChild(tx, ctx.familyId, run.childId, {
        kind: "SUBMISSION_APPROVED",
        title: `“${run.assignment.routine.name}” was approved`,
        body: input.note,
        entityType: "RoutineRun",
        entityId: run.id,
        dedupeKey: `review:${run.id}:approved`,
      });
    }
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
  params: { runId: string; reviewerUserId: string | null; isAutomatic: boolean; note?: string },
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
    data: { status: "APPROVED", reviewedAt: now, reviewNote: params.note ?? null },
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

/**
 * Retire a routine step (ADR 0011). Runs that become complete because of the removal are submitted
 * by the routine service; those on AUTO_APPROVE assignments are approved here, as for a last tick.
 */
export async function removeRoutineStepAndSettle(
  db: DbClient,
  ctx: ParentContext,
  input: { routineId: string; stepId: string },
) {
  const result = await removeRoutineStep(db, ctx, input);
  let autoApproved = 0;
  for (const run of result.submitted) {
    if (run.approvalPolicy !== "AUTO_APPROVE") continue;
    const approved = await db.$transaction(async (tx) => {
      await lockRoutineRun(tx, run.runId);
      return approveRoutineRunTx(tx, { runId: run.runId, reviewerUserId: null, isAutomatic: true });
    });
    await processCompletion(db, approved.completionId);
    autoApproved += 1;
  }
  return { ...result, autoApproved };
}
