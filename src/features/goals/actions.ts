"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { runAction, type ActionResult } from "@/lib/errors";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import {
  assignGoalSchema,
  createGoalSchema,
  setGoalArchivedSchema,
  updateGoalAssignmentSchema,
  updateGoalSchema,
} from "@/lib/validation/goals";
import { todayIn } from "@/lib/utils/dates";
import { requireParentContext } from "@/server/policies/context";
import {
  assignGoal,
  createGoal,
  repairGoalProgress,
  setGoalArchived,
  updateGoal,
  updateGoalAssignment,
} from "@/server/services/goal.service";

export async function createGoalAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(createGoalSchema, {
      ...formToObject(formData, { numbers: ["targetCount", "rewardPoints"] }),
      familyId: ctx.familyId,
    });
    const goal = await createGoal(prisma, ctx, input);
    revalidatePath("/parent/goals");
    return { goalId: goal.id };
  });
}

export async function assignGoalAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(assignGoalSchema, {
      ...formToObject(formData),
      childIds: formData.getAll("childIds").map(String),
      familyId: ctx.familyId,
    });
    const created = await assignGoal(prisma, ctx, input);
    revalidatePath("/parent/goals");
    return { count: created.length };
  });
}

export async function updateGoalAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(updateGoalSchema, {
      ...formToObject(formData, { numbers: ["targetCount", "rewardPoints"] }),
      familyId: ctx.familyId,
    });
    await updateGoal(prisma, ctx, input);
    revalidatePath("/parent/goals");
    revalidatePath("/child/goals");
    return { saved: true };
  });
}

export async function setGoalArchivedAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(setGoalArchivedSchema, {
      goalId: formData.get("goalId"),
      archived: formData.get("archived") === "true",
      familyId: ctx.familyId,
    });
    await setGoalArchived(prisma, ctx, input);
    revalidatePath("/parent/goals");
    revalidatePath("/child/goals");
    return { archived: input.archived };
  });
}

export async function updateGoalAssignmentAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const raw = formToObject(formData, { numbers: ["targetCount"] });
    const input = parseOrThrow(updateGoalAssignmentSchema, {
      ...raw,
      // An emptied optional field clears it (null) rather than leaving it unchanged.
      endDate: formData.has("endDate") ? (raw.endDate ?? null) : undefined,
      targetCount: raw.targetCount ?? null,
      familyId: ctx.familyId,
      today: todayIn(ctx.timezone),
    });
    await updateGoalAssignment(prisma, ctx, input);
    revalidatePath("/parent/goals");
    return { saved: true };
  });
}

export async function repairGoalAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const results = await repairGoalProgress(prisma, ctx, {
      familyId: ctx.familyId,
      goalId: String(formData.get("goalId") ?? ""),
    });
    revalidatePath("/parent/goals");
    return { repaired: results.filter((r) => r.changed).length };
  });
}
