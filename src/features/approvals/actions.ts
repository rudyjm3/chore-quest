"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { runAction, type ActionResult } from "@/lib/errors";
import {
  reviewOccurrenceSchema,
  reviewRoutineRunSchema,
  submitOccurrenceSchema,
} from "@/lib/validation/approvals";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import { completeRoutineStepSchema } from "@/lib/validation/routines";
import { requireChildContext, requireParentContext } from "@/server/policies/context";
import {
  completeRoutineStepAndSubmit,
  reviewOccurrence,
  reviewRoutineRun,
  submitOccurrence,
} from "@/server/services/approval.service";

export async function reviewOccurrenceAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(reviewOccurrenceSchema, {
      ...formToObject(formData),
      familyId: ctx.familyId,
    });
    const outcome = await reviewOccurrence(prisma, ctx, input);
    revalidatePath("/parent/approvals");
    revalidatePath("/parent");
    return outcome;
  });
}

export async function reviewRoutineRunAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(reviewRoutineRunSchema, {
      ...formToObject(formData),
      familyId: ctx.familyId,
    });
    const outcome = await reviewRoutineRun(prisma, ctx, input);
    revalidatePath("/parent/approvals");
    return outcome;
  });
}

/** Child: "I did it!" */
export async function submitOccurrenceAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const input = parseOrThrow(submitOccurrenceSchema, formToObject(formData));
    const result = await submitOccurrence(prisma, ctx, input.occurrenceId, input.note);
    revalidatePath("/child", "layout");
    return { policy: result.policy, approved: Boolean(result.approved) };
  });
}

/** Child: tick one routine step. */
export async function completeRoutineStepAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const input = parseOrThrow(completeRoutineStepSchema, formToObject(formData));
    const result = await completeRoutineStepAndSubmit(prisma, ctx, input.runId, input.stepId);
    revalidatePath("/child", "layout");
    return { allStepsDone: result.allStepsDone, autoApproved: result.autoApproved };
  });
}
