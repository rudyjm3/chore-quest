"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import { assignRoutineSchema, createRoutineSchema } from "@/lib/validation/routines";
import { requireParentContext } from "@/server/policies/context";
import { assignRoutine, createRoutine } from "@/server/services/routine.service";
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
