"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { runAction, type ActionResult } from "@/lib/errors";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import { assignGoalSchema, createGoalSchema } from "@/lib/validation/goals";
import { requireParentContext } from "@/server/policies/context";
import { assignGoal, createGoal } from "@/server/services/goal.service";

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
