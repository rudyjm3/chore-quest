"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getParentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getEmailSender } from "@/lib/email";
import { AppError, runAction, type ActionResult } from "@/lib/errors";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import {
  createInvitationSchema,
  invitationTokenSchema,
  removeGuardianSchema,
  revokeInvitationSchema,
} from "@/lib/validation/invitations";
import { ACTIVE_FAMILY_COOKIE, requireParentContext } from "@/server/policies/context";
import {
  acceptInvitation,
  createInvitation,
  removeGuardian,
  revokeInvitation,
} from "@/server/services/invitation.service";

type Prev = ActionResult<unknown> | null;

export async function createInvitationAction(_prev: Prev, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(createInvitationSchema, formToObject(formData));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error("NEXT_PUBLIC_APP_URL is not set");
    const result = await createInvitation(prisma, ctx, {
      email: input.email,
      appUrl,
      sender: getEmailSender(),
    });
    revalidatePath("/parent/settings");
    // The link is returned once so the owner can share it by hand if mail is not delivered.
    return { url: result.url, emailSent: result.emailSent };
  });
}

export async function revokeInvitationAction(_prev: Prev, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(revokeInvitationSchema, formToObject(formData));
    await revokeInvitation(prisma, ctx, input.invitationId);
    revalidatePath("/parent/settings");
    return { ok: true };
  });
}

export async function removeGuardianAction(_prev: Prev, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const input = parseOrThrow(removeGuardianSchema, formToObject(formData));
    await removeGuardian(prisma, ctx, input.memberId);
    revalidatePath("/parent/settings");
    return { ok: true };
  });
}

/** Accept an invitation as the signed-in user, switch to that family, and open the dashboard. */
export async function acceptInvitationAction(_prev: Prev, formData: FormData) {
  const result = await runAction(async () => {
    const session = await getParentSession();
    if (!session) throw AppError.unauthorized();
    const parsed = parseOrThrow(invitationTokenSchema, formData.get("token"));
    const { familyId } = await acceptInvitation(prisma, {
      userId: session.user.id,
      userEmail: session.user.email,
      token: parsed,
    });
    (await cookies()).set(ACTIVE_FAMILY_COOKIE, familyId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return { familyId };
  });
  if (result.ok) redirect("/parent");
  return result;
}
