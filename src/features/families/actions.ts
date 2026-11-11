"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { setChildSessionCookie } from "@/lib/auth/child-session-cookie";
import { prisma } from "@/lib/db/prisma";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import {
  createChildSchema,
  createFamilySchema,
  setChildPinSchema,
  updateFamilySettingsSchema,
} from "@/lib/validation/families";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import {
  ACTIVE_FAMILY_COOKIE,
  getParentContext,
  requireParentContext,
} from "@/server/policies/context";
import {
  createChild,
  setChildPin,
  startChildSessionAsParent,
} from "@/server/services/child.service";
import { createFamily, updateFamilySettings } from "@/server/services/family.service";

export async function createFamilyAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  const result = await runAction(async () => {
    const ctx = await getParentContext();
    if (!ctx) throw AppError.unauthorized();
    const input = parseOrThrow(
      createFamilySchema,
      formToObject(formData, { numbers: ["weekStartsOn"] }),
    );
    const family = await createFamily(prisma, ctx.userId, input);
    (await cookies()).set(ACTIVE_FAMILY_COOKIE, family.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return { familyId: family.id };
  });
  if (result.ok) redirect("/parent");
  return result;
}

export async function createChildAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(createChildSchema, {
      ...formToObject(formData, { numbers: ["birthYear"] }),
      familyId: ctx.familyId,
    });
    const child = await createChild(prisma, ctx, input);
    revalidatePath("/parent/children");
    return { childId: child.id };
  });
}

export async function setChildPinAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(setChildPinSchema, {
      ...formToObject(formData),
      familyId: ctx.familyId,
    });
    await setChildPin(prisma, ctx, input.childId, input.pin);
    revalidatePath("/parent/children");
    return { ok: true };
  });
}

export async function updateFamilySettingsAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(updateFamilySettingsSchema, {
      ...formToObject(formData, { numbers: ["weekStartsOn"], booleans: ["allowChildSelfSignIn"] }),
      familyId: ctx.familyId,
    });
    await updateFamilySettings(prisma, ctx, input);
    revalidatePath("/parent", "layout");
    return { ok: true };
  });
}

/** Parent hands the device to a child: starts a child session without a PIN. */
export async function startChildSessionAction(formData: FormData) {
  const ctx = await requireParentContext();
  const childId = String(formData.get("childId") ?? "");
  const { token, session } = await startChildSessionAsParent(prisma, ctx, childId);
  await setChildSessionCookie(token, session.expiresAt);
  redirect("/child");
}
