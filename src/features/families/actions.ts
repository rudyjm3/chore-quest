"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth/auth";
import { setChildSessionCookie } from "@/lib/auth/child-session-cookie";
import { prisma } from "@/lib/db/prisma";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import {
  childIdSchema,
  createChildSchema,
  createFamilySchema,
  setChildPinSchema,
  updateChildProfileSchema,
  updateFamilySettingsSchema,
} from "@/lib/validation/families";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import {
  ACTIVE_FAMILY_COOKIE,
  getParentContext,
  requireParentContext,
} from "@/server/policies/context";
import { requireChildInFamily } from "@/server/policies/family-access";
import {
  archiveChild,
  createChild,
  restoreChild,
  setChildPin,
  startChildSessionAsParent,
  updateChildProfile,
} from "@/server/services/child.service";
import {
  createFamily,
  rotateFamilyCode,
  updateFamilySettings,
} from "@/server/services/family.service";

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

/**
 * Parent hands the device to a child: starts a child session without a PIN.
 *
 * The parent's Better Auth session on this device is revoked first, so the child cannot
 * navigate back into /parent; the parent signs in again to regain access. Order matters:
 * if sign-out fails, no child session is created.
 */
export async function startChildSessionAction(formData: FormData) {
  const ctx = await requireParentContext();
  const childId = String(formData.get("childId") ?? "");
  await requireChildInFamily(prisma, ctx.familyId, childId);
  await auth.api.signOut({ headers: await headers() });
  const { token, session } = await startChildSessionAsParent(prisma, ctx, childId);
  await setChildSessionCookie(token, session.expiresAt);
  redirect("/child");
}

export async function updateChildProfileAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const raw = formToObject(formData);
    const input = parseOrThrow(updateChildProfileSchema, {
      familyId: ctx.familyId,
      childId: raw.childId,
      displayName: raw.displayName,
      avatarKey: raw.avatarKey ?? null,
    });
    await updateChildProfile(prisma, ctx, input);
    revalidatePath("/parent/children");
    return { ok: true };
  });
}

export async function archiveChildAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(childIdSchema, {
      familyId: ctx.familyId,
      childId: formData.get("childId"),
    });
    await archiveChild(prisma, ctx, input.childId);
    revalidatePath("/parent/children");
    return { ok: true };
  });
}

export async function restoreChildAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(childIdSchema, {
      familyId: ctx.familyId,
      childId: formData.get("childId"),
    });
    await restoreChild(prisma, ctx, input.childId);
    revalidatePath("/parent/children");
    return { ok: true };
  });
}

export async function rotateFamilyCodeAction(
  _prev: ActionResult<unknown> | null,
  _formData: FormData,
) {
  void _formData;
  return runAction(async () => {
    const ctx = await requireParentContext();
    const code = await rotateFamilyCode(prisma, ctx);
    revalidatePath("/parent", "layout");
    return { code };
  });
}
