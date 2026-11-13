"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { runAction, type ActionResult } from "@/lib/errors";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import {
  createRewardDefinitionSchema,
  parentAdjustmentSchema,
  requestRedemptionSchema,
  resolveRedemptionSchema,
  setRewardActiveSchema,
  updateRewardDefinitionSchema,
} from "@/lib/validation/rewards";
import { requireChildContext, requireParentContext } from "@/server/policies/context";
import {
  createRewardDefinition,
  parentAdjustment,
  requestRedemption,
  resolveRedemption,
  setRewardActive,
  updateRewardDefinition,
} from "@/server/services/reward.service";

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

const REWARD_NUMBERS = { numbers: ["costPoints", "stock"] };

export async function createRewardAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(createRewardDefinitionSchema, {
      ...formToObject(formData, REWARD_NUMBERS),
      familyId: ctx.familyId,
    });
    const reward = await createRewardDefinition(prisma, ctx, input);
    revalidatePath("/parent/rewards");
    return { rewardId: reward.id };
  });
}

export async function updateRewardAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(updateRewardDefinitionSchema, {
      ...formToObject(formData, REWARD_NUMBERS),
      familyId: ctx.familyId,
    });
    await updateRewardDefinition(prisma, ctx, input);
    revalidatePath("/parent/rewards");
    revalidatePath("/child/rewards");
    return { saved: true };
  });
}

export async function setRewardActiveAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(setRewardActiveSchema, {
      rewardId: formData.get("rewardId"),
      active: formData.get("active") === "true",
      familyId: ctx.familyId,
    });
    await setRewardActive(prisma, ctx, input);
    revalidatePath("/parent/rewards");
    revalidatePath("/child/rewards");
    return { active: input.active };
  });
}

export async function resolveRedemptionAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(resolveRedemptionSchema, {
      ...formToObject(formData),
      familyId: ctx.familyId,
    });
    const redemption = await resolveRedemption(prisma, ctx, input);
    revalidatePath("/parent/rewards");
    revalidatePath("/child/rewards");
    return { status: redemption.status };
  });
}

/** Child: ask for a reward. Points are reserved straight away. */
export async function requestRedemptionAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const input = parseOrThrow(requestRedemptionSchema, formToObject(formData));
    const redemption = await requestRedemption(prisma, ctx, input.rewardDefinitionId);
    revalidatePath("/child", "layout");
    return { redemptionId: redemption.id };
  });
}
