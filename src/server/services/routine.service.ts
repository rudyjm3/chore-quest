import type { Prisma } from "@/generated/prisma/client";
import { checkCompletionWindow, windowOf } from "@/features/routines/window";
import { scheduledDatesBetween } from "@/features/tasks/recurrence";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { addDays, dbToLocalDate, localDateToDb, todayIn, type LocalDate } from "@/lib/utils/dates";
import type {
  AssignRoutineInput,
  CreateRoutineInput,
  UpdateRoutineAssignmentInput,
  UpdateRoutineInput,
} from "@/lib/validation/routines";
import type { ChildContext, ParentContext } from "@/server/policies/context";
import { assertFamilyScope, assertPermission } from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";
import { notifyParents } from "./notification.service";

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
      steps: { where: { retiredAt: null }, orderBy: { sortOrder: "asc" }, include: { task: true } },
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
  if (routine.isArchived) throw AppError.invalidState("Restore this routine before assigning it");
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
      windowStart: input.windowStart ?? null,
      windowEnd: input.windowEnd ?? null,
    },
    update: {
      status: "ACTIVE",
      frequency: input.schedule.frequency,
      daysOfWeek: input.schedule.daysOfWeek,
      startDate: localDateToDb(input.schedule.startDate),
      endDate: input.schedule.endDate ? localDateToDb(input.schedule.endDate) : null,
      bonusPoints: input.bonusPoints,
      approvalPolicy: input.approvalPolicy,
      windowStart: input.windowStart ?? null,
      windowEnd: input.windowEnd ?? null,
    },
  });
}

export async function listArchivedRoutines(db: DbClient, familyId: string) {
  return db.routine.findMany({
    where: { familyId, isArchived: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}

async function requireRoutine(db: DbClient, ctx: ParentContext, routineId: string) {
  assertPermission(ctx, "canManageTasks");
  const routine = await db.routine.findFirst({
    where: { id: routineId, familyId: ctx.familyId },
    include: { steps: { where: { retiredAt: null }, orderBy: { sortOrder: "asc" } } },
  });
  if (!routine) throw AppError.notFound("Routine");
  return routine;
}

function auditRoutine(
  db: DbClient,
  ctx: ParentContext,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
) {
  return recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action,
    entityType,
    entityId,
    metadata,
  });
}

export async function updateRoutine(db: DbClient, ctx: ParentContext, input: UpdateRoutineInput) {
  assertFamilyScope(ctx, input.familyId);
  const routine = await requireRoutine(db, ctx, input.routineId);
  const updated = await db.routine.update({
    where: { id: routine.id },
    data: { name: input.name, description: input.description ?? null },
  });
  await auditRoutine(db, ctx, "routine.update", "Routine", routine.id);
  return updated;
}

export async function archiveRoutine(
  db: DbClient,
  ctx: ParentContext,
  routineId: string,
  archived: boolean,
) {
  const routine = await requireRoutine(db, ctx, routineId);
  await db.routine.update({ where: { id: routine.id }, data: { isArchived: archived } });
  await auditRoutine(
    db,
    ctx,
    archived ? "routine.archive" : "routine.restore",
    "Routine",
    routine.id,
  );
}

/**
 * Set the exact step order. `orderedStepIds` must be a permutation of the routine's steps.
 * The (routineId, sortOrder) unique index is checked per statement, so steps are first parked on
 * negative values and then given their final positions, all in one transaction.
 */
export async function reorderRoutineSteps(
  db: DbClient,
  ctx: ParentContext,
  routineId: string,
  orderedStepIds: string[],
) {
  const routine = await requireRoutine(db, ctx, routineId);
  const current = new Set(routine.steps.map((s) => s.id));
  if (
    orderedStepIds.length !== current.size ||
    new Set(orderedStepIds).size !== current.size ||
    !orderedStepIds.every((id) => current.has(id))
  ) {
    throw AppError.validation("The new order must list every step of the routine exactly once");
  }
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "routine" WHERE id = ${routine.id}::uuid FOR UPDATE`;
    for (const [index, id] of orderedStepIds.entries()) {
      await tx.routineStep.update({ where: { id }, data: { sortOrder: -(index + 1) } });
    }
    for (const [index, id] of orderedStepIds.entries()) {
      await tx.routineStep.update({ where: { id }, data: { sortOrder: index + 1 } });
    }
  });
  await auditRoutine(db, ctx, "routine.steps.reorder", "Routine", routine.id);
}

export async function moveRoutineStep(
  db: DbClient,
  ctx: ParentContext,
  routineId: string,
  stepId: string,
  direction: "up" | "down",
) {
  const routine = await requireRoutine(db, ctx, routineId);
  const ids = routine.steps.map((s) => s.id);
  const index = ids.indexOf(stepId);
  if (index === -1) throw AppError.notFound("Routine step");
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return;
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await reorderRoutineSteps(db, ctx, routineId, ids);
}

/**
 * Mark a step optional (the run can be submitted without it) or required again.
 * A routine must keep at least one required step. Takes effect for runs that are not yet finished.
 */
export async function setRoutineStepOptional(
  db: DbClient,
  ctx: ParentContext,
  routineId: string,
  stepId: string,
  isOptional: boolean,
) {
  assertPermission(ctx, "canManageTasks");
  const step = await db.$transaction(async (tx) => {
    // Lock the routine so two concurrent edits cannot each see "another required step exists".
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "routine" WHERE id = ${routineId}::uuid AND "familyId" = ${ctx.familyId}::uuid FOR UPDATE`;
    if (locked.length === 0) throw AppError.notFound("Routine");
    const steps = await tx.routineStep.findMany({ where: { routineId, retiredAt: null } });
    const target = steps.find((s) => s.id === stepId);
    if (!target) throw AppError.notFound("Routine step");
    if (isOptional && steps.filter((s) => s.id !== stepId && !s.isOptional).length === 0) {
      throw AppError.invalidState("A routine needs at least one required step");
    }
    await tx.routineStep.update({ where: { id: target.id }, data: { isOptional } });
    return target;
  });
  await auditRoutine(db, ctx, "routine.step.optional", "RoutineStep", step.id, { isOptional });
}

/** Edit an assignment's schedule, bonus, approval policy and completion window. Existing runs keep their snapshot. */
export async function updateRoutineAssignment(
  db: DbClient,
  ctx: ParentContext,
  input: UpdateRoutineAssignmentInput,
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const existing = await db.routineAssignment.findFirst({
    where: { id: input.assignmentId, familyId: input.familyId },
  });
  if (!existing) throw AppError.notFound("Routine assignment");
  const updated = await db.routineAssignment.update({
    where: { id: existing.id },
    data: {
      frequency: input.schedule.frequency,
      daysOfWeek: input.schedule.daysOfWeek,
      startDate: localDateToDb(input.schedule.startDate),
      endDate: input.schedule.endDate ? localDateToDb(input.schedule.endDate) : null,
      bonusPoints: input.bonusPoints,
      approvalPolicy: input.approvalPolicy,
      windowStart: input.windowStart ?? null,
      windowEnd: input.windowEnd ?? null,
    },
  });
  await auditRoutine(db, ctx, "routine.assignment.update", "RoutineAssignment", updated.id);
  return updated;
}

export async function updateRoutineAssignmentStatus(
  db: DbClient,
  ctx: ParentContext,
  assignmentId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED",
) {
  assertPermission(ctx, "canManageTasks");
  const existing = await db.routineAssignment.findFirst({
    where: { id: assignmentId, familyId: ctx.familyId },
  });
  if (!existing) throw AppError.notFound("Routine assignment");
  await db.routineAssignment.update({ where: { id: existing.id }, data: { status } });
  await auditRoutine(
    db,
    ctx,
    `routine.assignment.${status.toLowerCase()}`,
    "RoutineAssignment",
    existing.id,
  );
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
      child: { status: "ACTIVE" }, // archived children get no new work
      ...(params.childId ? { childId: params.childId } : {}),
    },
    include: { routine: { include: { steps: { where: { retiredAt: null } } } } },
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
    include: {
      assignment: { include: { routine: { include: { steps: { where: { retiredAt: null } } } } } },
    },
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
          routine: true,
        },
      },
      // A run's steps are its progress rows (ADR 0011): retired steps stay visible on finished runs.
      stepProgress: {
        include: { step: { include: { task: true } } },
        orderBy: { step: { sortOrder: "asc" } },
      },
    },
    orderBy: { localDate: "asc" },
  });
}

/**
 * Runs a child should see right now: today's, plus yesterday's unfinished run while its overnight
 * completion window (e.g. 20:00-06:00) is still open after local midnight.
 */
export async function listVisibleRunsForChild(
  db: DbClient,
  params: { familyId: string; childId: string; today: LocalDate; timezone: string; now?: Date },
) {
  const yesterday = addDays(params.today, -1);
  const runs = await listRunsForChild(db, {
    familyId: params.familyId,
    childId: params.childId,
    from: yesterday,
    to: params.today,
  });
  const now = params.now ?? new Date();
  return runs.filter((run) => {
    const localDate = dbToLocalDate(run.localDate);
    if (localDate === params.today) return true;
    if (run.status === "SUBMITTED" || run.status === "APPROVED") return false;
    const window = windowOf(run.assignment.windowStart, run.assignment.windowEnd);
    return (
      Boolean(window) &&
      checkCompletionWindow({ now, localDate, window, timeZone: params.timezone }).open
    );
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
    // Serialize with other step completions and with parent review of the same run, so two
    // concurrent "last step" requests cannot both read stale progress and leave the run open.
    await tx.$queryRaw`SELECT id FROM "routine_run" WHERE id = ${runId}::uuid FOR UPDATE`;
    const run = await tx.routineRun.findFirst({
      where: { id: runId, childId: ctx.childId, familyId: ctx.familyId },
      include: {
        assignment: { include: { routine: true } },
        stepProgress: { include: { step: true } },
      },
    });
    if (!run) throw AppError.notFound("Routine run");
    if (run.status === "APPROVED" || run.status === "SUBMITTED") {
      throw AppError.invalidState("This routine is already finished");
    }
    // Completion window (household-local), enforced here so the client cannot bypass it.
    const window = windowOf(run.assignment.windowStart, run.assignment.windowEnd);
    if (window) {
      const family = await tx.family.findUniqueOrThrow({
        where: { id: ctx.familyId },
        select: { timezone: true },
      });
      const check = checkCompletionWindow({
        now: new Date(),
        localDate: dbToLocalDate(run.localDate),
        window,
        timeZone: family.timezone,
      });
      if (!check.open) {
        throw AppError.invalidState(
          check.reason === "too-early"
            ? `This routine opens at ${check.opens}. Come back then!`
            : `This routine closed at ${check.closes}. Try again tomorrow!`,
        );
      }
    }
    const progress = run.stepProgress.find((p) => p.stepId === stepId);
    if (!progress || progress.step.retiredAt) throw AppError.notFound("Routine step");
    if (progress.status !== "DONE") {
      await tx.routineStepProgress.update({
        where: { id: progress.id },
        data: { status: "DONE", completedAt: new Date() },
      });
    }
    // Required = the run's own rows whose step is still active and not optional (ADR 0011).
    const required = run.stepProgress
      .filter((p) => !p.step.retiredAt && !p.step.isOptional)
      .map((p) => p.stepId);
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
    if (allDone && run.assignment.approvalPolicy !== "AUTO_APPROVE") {
      await notifyParents(tx, ctx.familyId, {
        kind: "SUBMISSION_PENDING",
        title: `${ctx.childName} finished “${run.assignment.routine.name}”`,
        entityType: "RoutineRun",
        entityId: run.id,
        dedupeKey: `routine-run:${run.id}:${updated.submittedAt?.toISOString() ?? "none"}`,
      });
    }
    return { run: updated, allStepsDone: allDone, approvalPolicy: run.assignment.approvalPolicy };
  });
}

/** Lock the routine, then its unfinished runs from `today` on, in id order (ADR 0011: routine → run). */
async function lockOpenRuns(tx: Prisma.TransactionClient, routineId: string, today: LocalDate) {
  await tx.$queryRaw`SELECT id FROM "routine" WHERE id = ${routineId}::uuid FOR UPDATE`;
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT r.id FROM "routine_run" r
    JOIN "routine_assignment" a ON a.id = r."assignmentId"
    WHERE a."routineId" = ${routineId}::uuid
      AND r.status IN ('PENDING', 'IN_PROGRESS', 'REJECTED')
      AND r."localDate" >= ${localDateToDb(today)}::date
    ORDER BY r.id
    FOR UPDATE OF r`;
  return rows.map((r) => r.id);
}

/**
 * Append a step (a family task) to an existing routine. Unfinished runs from today on get a PENDING
 * progress row; submitted/approved/past runs are not touched (ADR 0011).
 */
export async function addRoutineStep(
  db: DbClient,
  ctx: ParentContext,
  input: { routineId: string; taskId: string; isOptional: boolean },
) {
  assertPermission(ctx, "canManageTasks");
  const result = await db.$transaction(async (tx) => {
    const family = await tx.family.findUniqueOrThrow({
      where: { id: ctx.familyId },
      select: { timezone: true },
    });
    const runIds = await lockOpenRuns(tx, input.routineId, todayIn(family.timezone));
    const routine = await tx.routine.findFirst({
      where: { id: input.routineId, familyId: ctx.familyId },
      include: { steps: { where: { retiredAt: null } } },
    });
    if (!routine) throw AppError.notFound("Routine");
    if (routine.isArchived) throw AppError.invalidState("Restore this routine before editing it");
    const task = await tx.task.findFirst({
      where: { id: input.taskId, familyId: ctx.familyId, isArchived: false },
      select: { id: true },
    });
    if (!task) throw AppError.validation("Choose one of your active tasks");
    if (routine.steps.some((s) => s.taskId === task.id)) {
      throw AppError.invalidState("This task is already a step of the routine");
    }
    if (input.isOptional && routine.steps.every((s) => s.isOptional)) {
      throw AppError.invalidState("A routine needs at least one required step");
    }
    const sortOrder = routine.steps.reduce((max, s) => Math.max(max, s.sortOrder), 0) + 1;
    const step = await tx.routineStep.create({
      data: {
        routineId: routine.id,
        taskId: task.id,
        sortOrder,
        isOptional: input.isOptional,
      },
    });
    if (runIds.length) {
      await tx.routineStepProgress.createMany({
        data: runIds.map((runId) => ({ runId, stepId: step.id })),
        skipDuplicates: true,
      });
      // A run that was only waiting on a (now added) required step can no longer be complete; runs
      // are unfinished here by construction, so nothing else changes.
    }
    return { step, runsUpdated: runIds.length };
  });
  await auditRoutine(db, ctx, "routine.step.add", "RoutineStep", result.step.id, {
    routineId: input.routineId,
    taskId: input.taskId,
    isOptional: input.isOptional,
    runsUpdated: result.runsUpdated,
  });
  return result;
}

/**
 * Retire a step (never deleted). Unfinished runs whose remaining required steps are all done are
 * submitted in the same transaction. Returns those runs so the caller can auto-approve where the
 * assignment policy says so.
 */
export async function removeRoutineStep(
  db: DbClient,
  ctx: ParentContext,
  input: { routineId: string; stepId: string },
) {
  assertPermission(ctx, "canManageTasks");
  const result = await db.$transaction(async (tx) => {
    const family = await tx.family.findUniqueOrThrow({
      where: { id: ctx.familyId },
      select: { timezone: true },
    });
    const runIds = await lockOpenRuns(tx, input.routineId, todayIn(family.timezone));
    const routine = await tx.routine.findFirst({
      where: { id: input.routineId, familyId: ctx.familyId },
      include: { steps: { where: { retiredAt: null } } },
    });
    if (!routine) throw AppError.notFound("Routine");
    const target = routine.steps.find((s) => s.id === input.stepId);
    if (!target) throw AppError.notFound("Routine step");
    if (!target.isOptional && routine.steps.filter((s) => !s.isOptional).length === 1) {
      throw AppError.invalidState("A routine needs at least one required step");
    }
    await tx.routineStep.update({ where: { id: target.id }, data: { retiredAt: new Date() } });

    const submitted: Array<{ runId: string; approvalPolicy: string }> = [];
    if (runIds.length) {
      const runs = await tx.routineRun.findMany({
        where: { id: { in: runIds }, status: { in: ["PENDING", "IN_PROGRESS", "REJECTED"] } },
        include: {
          assignment: { include: { routine: { select: { name: true } } } },
          stepProgress: { include: { step: true } },
        },
      });
      for (const run of runs) {
        const rows = run.stepProgress.filter((p) => p.stepId !== target.id && !p.step.retiredAt);
        const required = rows.filter((p) => !p.step.isOptional);
        const anyDone = rows.some((p) => p.status === "DONE");
        // Only runs the child already worked on can complete by removal; an untouched run stays open.
        if (!anyDone || !required.every((p) => p.status === "DONE")) continue;
        const now = new Date();
        await tx.routineRun.update({
          where: { id: run.id },
          data: { status: "SUBMITTED", submittedAt: now, startedAt: run.startedAt ?? now },
        });
        if (run.assignment.approvalPolicy !== "AUTO_APPROVE") {
          const child = await tx.child.findUniqueOrThrow({
            where: { id: run.childId },
            select: { displayName: true },
          });
          await notifyParents(tx, ctx.familyId, {
            kind: "SUBMISSION_PENDING",
            title: `${child.displayName} finished “${run.assignment.routine.name}”`,
            entityType: "RoutineRun",
            entityId: run.id,
            dedupeKey: `routine-run:${run.id}:${now.toISOString()}`,
          });
        }
        submitted.push({ runId: run.id, approvalPolicy: run.assignment.approvalPolicy });
      }
    }
    return { stepId: target.id, runsOpen: runIds.length, submitted };
  });
  await auditRoutine(db, ctx, "routine.step.remove", "RoutineStep", result.stepId, {
    routineId: input.routineId,
    runsOpen: result.runsOpen,
    runsSubmitted: result.submitted.length,
  });
  return result;
}
