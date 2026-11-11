import type { Prisma } from "@/generated/prisma/client";
import { scheduledDatesBetween } from "@/features/tasks/recurrence";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { dbToLocalDate, localDateToDb, type LocalDate } from "@/lib/utils/dates";
import type { AssignRoutineInput, CreateRoutineInput } from "@/lib/validation/routines";
import type { ChildContext, ParentContext } from "@/server/policies/context";
import { assertFamilyScope, assertPermission } from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";

export async function listRoutineTemplates(db: DbClient) {
  return db.routineTemplate.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { steps: { orderBy: { sortOrder: "asc" }, include: { preset: true } } },
  });
}

export async function listRoutines(db: DbClient, familyId: string) {
  return db.routine.findMany({
    where: { familyId, isArchived: false },
    orderBy: { createdAt: "asc" },
    include: {
      steps: { orderBy: { sortOrder: "asc" }, include: { task: true } },
      assignments: true,
    },
  });
}

/** Create a routine from an ordered list of the family's tasks. */
export async function createRoutine(db: DbClient, ctx: ParentContext, input: CreateRoutineInput) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const tasks = await db.task.findMany({
    where: { id: { in: input.taskIds }, familyId: input.familyId, isArchived: false },
    select: { id: true },
  });
  if (tasks.length !== new Set(input.taskIds).size) {
    throw AppError.validation("All routine steps must reference tasks in this family");
  }
  const routine = await db.routine.create({
    data: {
      familyId: input.familyId,
      name: input.name,
      description: input.description,
      iconKey: input.iconKey,
      steps: { create: input.taskIds.map((taskId, index) => ({ taskId, sortOrder: index + 1 })) },
    },
    include: { steps: { orderBy: { sortOrder: "asc" } } },
  });
  await recordAudit(db, {
    familyId: routine.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "routine.create",
    entityType: "Routine",
    entityId: routine.id,
  });
  return routine;
}

export async function assignRoutine(db: DbClient, ctx: ParentContext, input: AssignRoutineInput) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const routine = await db.routine.findFirst({
    where: { id: input.routineId, familyId: input.familyId },
  });
  if (!routine) throw AppError.notFound("Routine");
  const child = await db.child.findFirst({
    where: { id: input.childId, familyId: input.familyId, status: "ACTIVE" },
  });
  if (!child) throw AppError.forbidden("Child does not belong to this family");
  return db.routineAssignment.upsert({
    where: { routineId_childId: { routineId: routine.id, childId: child.id } },
    create: {
      familyId: input.familyId,
      routineId: routine.id,
      childId: child.id,
      frequency: input.schedule.frequency,
      daysOfWeek: input.schedule.daysOfWeek,
      startDate: localDateToDb(input.schedule.startDate),
      endDate: input.schedule.endDate ? localDateToDb(input.schedule.endDate) : null,
      bonusPoints: input.bonusPoints,
      approvalPolicy: input.approvalPolicy,
    },
    update: {
      status: "ACTIVE",
      frequency: input.schedule.frequency,
      daysOfWeek: input.schedule.daysOfWeek,
      startDate: localDateToDb(input.schedule.startDate),
      endDate: input.schedule.endDate ? localDateToDb(input.schedule.endDate) : null,
      bonusPoints: input.bonusPoints,
      approvalPolicy: input.approvalPolicy,
    },
  });
}

/** Materialize routine runs (and their step progress rows) for a date range. Idempotent. */
export async function ensureRoutineRuns(
  db: DbClient,
  params: { familyId: string; childId?: string; from: LocalDate; to: LocalDate },
) {
  const assignments = await db.routineAssignment.findMany({
    where: {
      familyId: params.familyId,
      status: "ACTIVE",
      ...(params.childId ? { childId: params.childId } : {}),
    },
    include: { routine: { include: { steps: true } } },
  });
  const rows: Prisma.RoutineRunCreateManyInput[] = [];
  for (const assignment of assignments) {
    if (assignment.routine.isArchived) continue;
    const dates = scheduledDatesBetween(
      {
        frequency: assignment.frequency,
        daysOfWeek: assignment.daysOfWeek,
        startDate: dbToLocalDate(assignment.startDate),
        endDate: assignment.endDate ? dbToLocalDate(assignment.endDate) : null,
      },
      params.from,
      params.to,
    );
    for (const localDate of dates) {
      rows.push({
        familyId: assignment.familyId,
        assignmentId: assignment.id,
        childId: assignment.childId,
        localDate: localDateToDb(localDate),
        bonusPointsSnapshot: assignment.bonusPoints,
      });
    }
  }
  if (rows.length === 0) return { created: 0 };
  const result = await db.routineRun.createMany({ data: rows, skipDuplicates: true });

  // Step progress rows for any run that lacks them (new runs only, in practice).
  const runs = await db.routineRun.findMany({
    where: {
      familyId: params.familyId,
      localDate: { gte: localDateToDb(params.from), lte: localDateToDb(params.to) },
      stepProgress: { none: {} },
    },
    include: { assignment: { include: { routine: { include: { steps: true } } } } },
  });
  const stepRows: Prisma.RoutineStepProgressCreateManyInput[] = [];
  for (const run of runs) {
    for (const step of run.assignment.routine.steps)
      stepRows.push({ runId: run.id, stepId: step.id });
  }
  if (stepRows.length)
    await db.routineStepProgress.createMany({ data: stepRows, skipDuplicates: true });
  return { created: result.count };
}

export async function listRunsForChild(
  db: DbClient,
  params: { familyId: string; childId: string; from: LocalDate; to: LocalDate },
) {
  return db.routineRun.findMany({
    where: {
      familyId: params.familyId,
      childId: params.childId,
      localDate: { gte: localDateToDb(params.from), lte: localDateToDb(params.to) },
    },
    include: {
      assignment: {
        include: {
          routine: {
            include: { steps: { include: { task: true }, orderBy: { sortOrder: "asc" } } },
          },
        },
      },
      stepProgress: true,
    },
    orderBy: { localDate: "asc" },
  });
}

/** Child marks one step done. The run auto-submits when every required step is done. */
export async function completeRoutineStep(
  db: DbClient,
  ctx: ChildContext,
  runId: string,
  stepId: string,
) {
  return db.$transaction(async (tx) => {
    const run = await tx.routineRun.findFirst({
      where: { id: runId, childId: ctx.childId, familyId: ctx.familyId },
      include: {
        assignment: { include: { routine: { include: { steps: true } } } },
        stepProgress: true,
      },
    });
    if (!run) throw AppError.notFound("Routine run");
    if (run.status === "APPROVED" || run.status === "SUBMITTED") {
      throw AppError.invalidState("This routine is already finished");
    }
    const progress = run.stepProgress.find((p) => p.stepId === stepId);
    if (!progress) throw AppError.notFound("Routine step");
    if (progress.status !== "DONE") {
      await tx.routineStepProgress.update({
        where: { id: progress.id },
        data: { status: "DONE", completedAt: new Date() },
      });
    }
    const required = run.assignment.routine.steps.filter((s) => !s.isOptional).map((s) => s.id);
    const doneIds = new Set(
      run.stepProgress
        .filter((p) => p.status === "DONE" || p.stepId === stepId)
        .map((p) => p.stepId),
    );
    const allDone = required.every((id) => doneIds.has(id));
    const updated = await tx.routineRun.update({
      where: { id: run.id },
      data: {
        status: allDone ? "SUBMITTED" : "IN_PROGRESS",
        startedAt: run.startedAt ?? new Date(),
        submittedAt: allDone ? new Date() : undefined,
      },
    });
    return { run: updated, allStepsDone: allDone, approvalPolicy: run.assignment.approvalPolicy };
  });
}
