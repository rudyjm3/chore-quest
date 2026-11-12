"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { runAction, type ActionResult } from "@/lib/errors";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import {
  addPresetSchema,
  archiveTaskSchema,
  assignTaskSchema,
  createTaskSchema,
  updateAssignmentSchema,
  updateAssignmentStatusSchema,
  updateTaskSchema,
} from "@/lib/validation/tasks";
import { requireParentContext } from "@/server/policies/context";
import {
  assignTask,
  createTask,
  createTaskFromPreset,
  updateAssignment,
  updateAssignmentStatus,
  updateTask,
} from "@/server/services/task.service";

export async function createTaskAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(createTaskSchema, {
      ...formToObject(formData, { numbers: ["points"] }),
      familyId: ctx.familyId,
    });
    const task = await createTask(prisma, ctx, input);
    revalidatePath("/parent/tasks");
    return { taskId: task.id };
  });
}

export async function assignTaskAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const raw = formToObject(formData, {
      numbers: ["pointsOverride"],
      numberArrays: ["daysOfWeek"],
    });
    const childIds = formData.getAll("childIds").map(String);
    const input = parseOrThrow(assignTaskSchema, {
      familyId: ctx.familyId,
      taskId: raw.taskId,
      childIds,
      schedule: {
        frequency: raw.frequency,
        daysOfWeek: raw.daysOfWeek ?? [],
        startDate: raw.startDate,
        endDate: raw.endDate,
        dueTime: raw.dueTime,
      },
      pointsOverride: raw.pointsOverride,
      approvalPolicyOverride: raw.approvalPolicyOverride,
    });
    const created = await assignTask(prisma, ctx, input);
    revalidatePath("/parent/tasks");
    return { count: created.length };
  });
}

export async function updateAssignmentStatusAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(updateAssignmentStatusSchema, {
      ...formToObject(formData),
      familyId: ctx.familyId,
    });
    await updateAssignmentStatus(prisma, ctx, input.assignmentId, input.status);
    revalidatePath("/parent/tasks");
    return { ok: true };
  });
}

export async function updateTaskAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(updateTaskSchema, {
      ...formToObject(formData, { numbers: ["points"] }),
      familyId: ctx.familyId,
    });
    await updateTask(prisma, ctx, input);
    revalidatePath("/parent/tasks");
    return { ok: true };
  });
}

export async function archiveTaskAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(archiveTaskSchema, {
      familyId: ctx.familyId,
      taskId: formData.get("taskId"),
      archived: formData.get("archived") === "true",
    });
    await updateTask(prisma, ctx, {
      familyId: input.familyId,
      taskId: input.taskId,
      isArchived: input.archived,
    });
    revalidatePath("/parent/tasks");
    return { ok: true };
  });
}

export async function addPresetAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(addPresetSchema, {
      familyId: ctx.familyId,
      presetKey: formData.get("presetKey"),
    });
    const task = await createTaskFromPreset(prisma, ctx, input.familyId, input.presetKey);
    revalidatePath("/parent/tasks");
    return { taskId: task.id };
  });
}

export async function updateAssignmentAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const raw = formToObject(formData, {
      numbers: ["pointsOverride"],
      numberArrays: ["daysOfWeek"],
    });
    const input = parseOrThrow(updateAssignmentSchema, {
      familyId: ctx.familyId,
      assignmentId: raw.assignmentId,
      schedule: {
        frequency: raw.frequency,
        daysOfWeek: raw.daysOfWeek ?? [],
        startDate: raw.startDate,
        endDate: raw.endDate,
        dueTime: raw.dueTime,
      },
      pointsOverride: raw.pointsOverride,
      approvalPolicyOverride: raw.approvalPolicyOverride,
    });
    await updateAssignment(prisma, ctx, input);
    revalidatePath("/parent/tasks");
    return { ok: true };
  });
}
