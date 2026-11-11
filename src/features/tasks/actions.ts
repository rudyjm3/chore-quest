"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { runAction, type ActionResult } from "@/lib/errors";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import {
  assignTaskSchema,
  createTaskSchema,
  updateAssignmentStatusSchema,
} from "@/lib/validation/tasks";
import { requireParentContext } from "@/server/policies/context";
import { assignTask, createTask, updateAssignmentStatus } from "@/server/services/task.service";

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
