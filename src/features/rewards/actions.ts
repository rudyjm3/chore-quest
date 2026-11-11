"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { runAction, type ActionResult } from "@/lib/errors";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import { parentAdjustmentSchema } from "@/lib/validation/rewards";
import { requireParentContext } from "@/server/policies/context";
import { parentAdjustment } from "@/server/services/reward.service";

export async function parentAdjustmentAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(parentAdjustmentSchema, {
      ...formToObject(formData, { numbers: ["amount"] }),
      familyId: ctx.familyId,
    });
    const result = await parentAdjustment(prisma, ctx, input);
    revalidatePath("/parent/rewards");
    return { created: result.created };
  });
}
