"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import {
  archiveRoutineSchema,
  assignRoutineSchema,
  createRoutineSchema,
  moveRoutineStepSchema,
  routineAssignmentStatusSchema,
  setStepOptionalSchema,
  updateRoutineAssignmentSchema,
  updateRoutineSchema,
} from "@/lib/validation/routines";
import { requireParentContext } from "@/server/policies/context";
import {
  archiveRoutine,
  assignRoutine,
  createRoutine,
  moveRoutineStep,
  setRoutineStepOptional,
  updateRoutine,
  updateRoutineAssignment,
  updateRoutineAssignmentStatus,
} from "@/server/services/routine.service";
import { createTask } from "@/server/services/task.service";

/** Create a routine from selected family tasks, or from a global template (creating tasks from presets as needed). */
export async function createRoutineAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const raw = formToObject(formData);
    let taskIds = formData.getAll("taskIds").map(String).filter(Boolean);

    if (raw.templateKey) {
      const template = await prisma.routineTemplate.findUnique({
        where: { key: String(raw.templateKey) },
        include: { steps: { orderBy: { sortOrder: "asc" }, include: { preset: true } } },
      });
      if (!template) throw AppError.notFound("Routine template");
      taskIds = [];
      for (const step of template.steps) {
        const existing = await prisma.task.findFirst({
          where: { familyId: ctx.familyId, presetId: step.presetId, isArchived: false },
        });
        const task =
          existing ??
          (await createTask(prisma, ctx, {
            familyId: ctx.familyId,
            presetKey: step.preset.key,
            title: step.preset.title,
            category: step.preset.category,
            points: step.preset.defaultPoints,
            approvalPolicy: "PARENT_REVIEW",
          }));
        taskIds.push(task.id);
      }
      raw.name ??= template.name;
      raw.description ??= template.description ?? undefined;
      raw.iconKey ??= template.iconKey ?? undefined;
    }

    const input = parseOrThrow(createRoutineSchema, { ...raw, familyId: ctx.familyId, taskIds });
    const routine = await createRoutine(prisma, ctx, input);
    revalidatePath("/parent/routines");
    revalidatePath("/parent/tasks");
    return { routineId: routine.id };
  });
}

export async function assignRoutineAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const raw = formToObject(formData, { numbers: ["bonusPoints"], numberArrays: ["daysOfWeek"] });
    const input = parseOrThrow(assignRoutineSchema, {
      familyId: ctx.familyId,
      routineId: raw.routineId,
      childId: raw.childId,
      bonusPoints: raw.bonusPoints ?? 0,
      approvalPolicy: raw.approvalPolicy ?? "PARENT_REVIEW",
      windowStart: raw.windowStart,
      windowEnd: raw.windowEnd,
      schedule: {
        frequency: raw.frequency,
        daysOfWeek: raw.daysOfWeek ?? [],
        startDate: raw.startDate,
        endDate: raw.endDate,
      },
    });
    await assignRoutine(prisma, ctx, input);
    revalidatePath("/parent/routines");
    return { ok: true };
  });
}

type Prev = ActionResult<unknown> | null;

export async function updateRoutineAction(_prev: Prev, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(updateRoutineSchema, {
      ...formToObject(formData),
      familyId: ctx.familyId,
    });
    await updateRoutine(prisma, ctx, input);
    revalidatePath("/parent/routines");
    return { ok: true };
  });
}

export async function moveRoutineStepAction(_prev: Prev, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(moveRoutineStepSchema, {
      ...formToObject(formData),
      familyId: ctx.familyId,
    });
    await moveRoutineStep(prisma, ctx, input.routineId, input.stepId, input.direction);
    revalidatePath("/parent/routines");
    return { ok: true };
  });
}

export async function setStepOptionalAction(_prev: Prev, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(setStepOptionalSchema, {
      familyId: ctx.familyId,
      routineId: formData.get("routineId"),
      stepId: formData.get("stepId"),
      isOptional: formData.get("isOptional") === "true",
    });
    await setRoutineStepOptional(prisma, ctx, input.routineId, input.stepId, input.isOptional);
    revalidatePath("/parent/routines");
    return { ok: true };
  });
}

export async function archiveRoutineAction(_prev: Prev, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(archiveRoutineSchema, {
      familyId: ctx.familyId,
      routineId: formData.get("routineId"),
      archived: formData.get("archived") === "true",
    });
    await archiveRoutine(prisma, ctx, input.routineId, input.archived);
    revalidatePath("/parent/routines");
    return { ok: true };
  });
}

export async function updateRoutineAssignmentAction(_prev: Prev, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const raw = formToObject(formData, { numbers: ["bonusPoints"], numberArrays: ["daysOfWeek"] });
    const input = parseOrThrow(updateRoutineAssignmentSchema, {
      familyId: ctx.familyId,
      assignmentId: raw.assignmentId,
      bonusPoints: raw.bonusPoints ?? 0,
      approvalPolicy: raw.approvalPolicy ?? "PARENT_REVIEW",
      windowStart: raw.windowStart,
      windowEnd: raw.windowEnd,
      schedule: {
        frequency: raw.frequency,
        daysOfWeek: raw.daysOfWeek ?? [],
        startDate: raw.startDate,
        endDate: raw.endDate,
      },
    });
    await updateRoutineAssignment(prisma, ctx, input);
    revalidatePath("/parent/routines");
    return { ok: true };
  });
}

export async function routineAssignmentStatusAction(_prev: Prev, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(routineAssignmentStatusSchema, {
      ...formToObject(formData),
      familyId: ctx.familyId,
    });
    await updateRoutineAssignmentStatus(prisma, ctx, input.assignmentId, input.status);
    revalidatePath("/parent/routines");
    return { ok: true };
  });
}
