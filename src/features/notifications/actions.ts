"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db/prisma";
import { runAction, type ActionResult } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation/form";
import { markNotificationsReadSchema } from "@/lib/validation/notifications";
import { requireChildContext, requireParentContext } from "@/server/policies/context";
import { markNotificationsRead } from "@/server/services/notification.service";

function idsFrom(formData: FormData) {
  const ids = formData.getAll("ids").map(String);
  return parseOrThrow(markNotificationsReadSchema, { ids: ids.length ? ids : undefined });
}

export async function markParentNotificationsReadAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireParentContext();
    const result = await markNotificationsRead(prisma, ctx, idsFrom(formData).ids);
    revalidatePath("/parent", "layout");
    return result;
  });
}

export async function markChildNotificationsReadAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const result = await markNotificationsRead(prisma, ctx, idsFrom(formData).ids);
    revalidatePath("/child", "layout");
    return result;
  });
}
