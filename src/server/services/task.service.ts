import type { Prisma } from "@/generated/prisma/client";
import { effectivePoints, scheduledDatesBetween } from "@/features/tasks/recurrence";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import {
  dbToLocalDate,
  localDateTimeToInstant,
  localDateToDb,
  type LocalDate,
} from "@/lib/utils/dates";
import type { AssignTaskInput, CreateTaskInput, UpdateTaskInput } from "@/lib/validation/tasks";
import type { ParentContext } from "@/server/policies/context";
import { assertFamilyScope, assertPermission } from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";

export async function listTaskPresets(db: DbClient) {
  return db.taskPreset.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
}

export async function listTasks(db: DbClient, familyId: string, includeArchived = false) {
  return db.task.findMany({
    where: { familyId, ...(includeArchived ? {} : { isArchived: false }) },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { assignments: true } } },
  });
}

/** Create a family task, optionally seeded from a global preset. */
export async function createTask(db: DbClient, ctx: ParentContext, input: CreateTaskInput) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const preset = input.presetKey
    ? await db.taskPreset.findUnique({ where: { key: input.presetKey } })
    : null;
  if (input.presetKey && !preset) throw AppError.notFound("Task preset");
  const task = await db.task.create({
    data: {
      familyId: input.familyId,
      presetId: preset?.id,
      title: input.title,
      description: input.description ?? preset?.description ?? undefined,
      category: input.category ?? preset?.category ?? "CHORE",
      iconKey: input.iconKey ?? preset?.iconKey ?? undefined,
      points: input.points ?? preset?.defaultPoints ?? 5,
      approvalPolicy: input.approvalPolicy,
      createdById: ctx.userId,
    },
  });
  await recordAudit(db, {
    familyId: task.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "task.create",
    entityType: "Task",
    entityId: task.id,
  });
  return task;
}

export async function updateTask(db: DbClient, ctx: ParentContext, input: UpdateTaskInput) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const existing = await db.task.findFirst({
    where: { id: input.taskId, familyId: input.familyId },
  });
  if (!existing) throw AppError.notFound("Task");
  const { taskId, familyId: _familyId, ...data } = input;
  void _familyId;
  return db.task.update({ where: { id: taskId }, data });
}

/** Assign a task to one or more children with the same schedule. */
export async function assignTask(db: DbClient, ctx: ParentContext, input: AssignTaskInput) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageTasks");
  const task = await db.task.findFirst({
    where: { id: input.taskId, familyId: input.familyId, isArchived: false },
  });
  if (!task) throw AppError.notFound("Task");
  const children = await db.child.findMany({
    where: { id: { in: input.childIds }, familyId: input.familyId, status: "ACTIVE" },
    select: { id: true },
  });
  if (children.length !== new Set(input.childIds).size) {
    throw AppError.forbidden("One or more children do not belong to this family");
  }
  const created = await db.$transaction(
    children.map((child) =>
      db.taskAssignment.create({
        data: {
          familyId: input.familyId,
          taskId: task.id,
          childId: child.id,
          frequency: input.schedule.frequency,
          daysOfWeek: input.schedule.daysOfWeek,
          startDate: localDateToDb(input.schedule.startDate),
          endDate: input.schedule.endDate ? localDateToDb(input.schedule.endDate) : null,
          dueTime: input.schedule.dueTime,
          pointsOverride: input.pointsOverride,
          approvalPolicyOverride: input.approvalPolicyOverride,
        },
      }),
    ),
  );
  for (const assignment of created) {
    await recordAudit(db, {
      familyId: input.familyId,
      actorType: "PARENT",
      actorUserId: ctx.userId,
      action: "task.assign",
      entityType: "TaskAssignment",
      entityId: assignment.id,
      metadata: { taskId: task.id, childId: assignment.childId },
    });
  }
  return created;
}

export async function updateAssignmentStatus(
  db: DbClient,
  ctx: ParentContext,
  assignmentId: string,
  status: "ACTIVE" | "PAUSED" | "ARCHIVED",
) {
  assertPermission(ctx, "canManageTasks");
  const assignment = await db.taskAssignment.findFirst({
    where: { id: assignmentId, familyId: ctx.familyId },
  });
  if (!assignment) throw AppError.notFound("Assignment");
  return db.taskAssignment.update({ where: { id: assignment.id }, data: { status } });
}

/** Edit the schedule/points of an existing assignment. Past occurrences keep their snapshot. */
export async function updateAssignmentPoints(
  db: DbClient,
  ctx: ParentContext,
  assignmentId: string,
  pointsOverride: number | null,
) {
  assertPermission(ctx, "canManageTasks");
  const assignment = await db.taskAssignment.findFirst({
    where: { id: assignmentId, familyId: ctx.familyId },
  });
  if (!assignment) throw AppError.notFound("Assignment");
  return db.taskAssignment.update({ where: { id: assignment.id }, data: { pointsOverride } });
}

/**
 * Materialize occurrences for every ACTIVE assignment in a family between two
 * local dates (inclusive). Idempotent: the (assignmentId, localDate) unique
 * constraint plus `skipDuplicates` means re-running never creates duplicates
 * and never rewrites existing occurrences (so point snapshots are preserved).
 */
export async function ensureTaskOccurrences(
  db: DbClient,
  params: { familyId: string; childId?: string; from: LocalDate; to: LocalDate },
) {
  const family = await db.family.findUnique({
    where: { id: params.familyId },
    select: { timezone: true },
  });
  if (!family) throw AppError.notFound("Family");
  const assignments = await db.taskAssignment.findMany({
    where: {
      familyId: params.familyId,
      status: "ACTIVE",
      ...(params.childId ? { childId: params.childId } : {}),
    },
    include: { task: { select: { points: true, isArchived: true } } },
  });

  const rows: Prisma.TaskOccurrenceCreateManyInput[] = [];
  for (const assignment of assignments) {
    if (assignment.task.isArchived) continue;
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
        dueAt: assignment.dueTime
          ? localDateTimeToInstant(localDate, assignment.dueTime, family.timezone)
          : null,
        pointsSnapshot: effectivePoints(assignment.task.points, assignment.pointsOverride),
      });
    }
  }
  if (rows.length === 0) return { created: 0 };
  const result = await db.taskOccurrence.createMany({ data: rows, skipDuplicates: true });
  return { created: result.count };
}

export async function listOccurrencesForChild(
  db: DbClient,
  params: { familyId: string; childId: string; from: LocalDate; to: LocalDate },
) {
  return db.taskOccurrence.findMany({
    where: {
      familyId: params.familyId,
      childId: params.childId,
      localDate: { gte: localDateToDb(params.from), lte: localDateToDb(params.to) },
    },
    include: { assignment: { include: { task: true } }, submission: true },
    orderBy: [{ localDate: "asc" }, { dueAt: "asc" }],
  });
}

export async function listPendingReviews(db: DbClient, familyId: string) {
  return db.taskOccurrence.findMany({
    where: { familyId, status: "SUBMITTED" },
    include: { assignment: { include: { task: true } }, child: true, submission: true },
    orderBy: { submittedAt: "asc" },
  });
}
