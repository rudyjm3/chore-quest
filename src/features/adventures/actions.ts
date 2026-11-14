"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { clearChildSessionCookie, setChildSessionCookie } from "@/lib/auth/child-session-cookie";
import { prisma } from "@/lib/db/prisma";
import { runAction, type ActionResult } from "@/lib/errors";
import {
  claimChapterRewardSchema,
  equipCosmeticSchema,
  purchaseItemSchema,
  startAdventureSchema,
  submitPuzzleSchema,
  visitLocationSchema,
} from "@/lib/validation/adventures";
import { childSignInSchema, familyCodeLookupSchema } from "@/lib/validation/families";
import { formToObject, parseOrThrow } from "@/lib/validation/form";
import { getChildContext, requireChildContext } from "@/server/policies/context";
import {
  claimChapterReward,
  startAdventure,
  submitPuzzleAnswer,
} from "@/server/services/adventure.service";
import {
  lookupFamilyForChildSignIn,
  revokeChildSession,
  signInChild,
} from "@/server/services/child.service";
import { equipCosmetic } from "@/server/services/crew-camp.service";
import { lookOutFromLighthouse, visitLocation } from "@/server/services/location.service";
import { purchaseItem } from "@/server/services/inventory.service";

// --- Child sign-in -----------------------------------------------------------

export async function lookupFamilyAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const input = parseOrThrow(familyCodeLookupSchema, formToObject(formData));
    const family = await lookupFamilyForChildSignIn(prisma, input.familyCode);
    if (!family) return { found: false as const };
    return {
      found: true as const,
      familyCode: input.familyCode,
      familyName: family.name,
      children: family.children,
    };
  });
}

export async function childSignInAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  const result = await runAction(async () => {
    const input = parseOrThrow(childSignInSchema, formToObject(formData));
    const { token, session } = await signInChild(prisma, input);
    await setChildSessionCookie(token, session.expiresAt);
    return { ok: true };
  });
  if (result.ok) redirect("/child");
  return result;
}

export async function childSignOutAction() {
  const ctx = await getChildContext();
  if (ctx) await revokeChildSession(prisma, ctx.sessionId);
  await clearChildSessionCookie();
  redirect("/child/sign-in");
}

// --- Gameplay ----------------------------------------------------------------

export async function startAdventureAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const input = parseOrThrow(startAdventureSchema, formToObject(formData));
    await startAdventure(prisma, {
      familyId: ctx.familyId,
      childId: ctx.childId,
      adventureKey: input.adventureKey,
    });
    revalidatePath("/child/adventure", "layout");
    return { ok: true };
  });
}

export async function claimChapterRewardAction(
  _prev: ActionResult<unknown> | null,
  formData: FormData,
) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const input = parseOrThrow(claimChapterRewardSchema, formToObject(formData));
    const result = await claimChapterReward(prisma, ctx, input.chapterId);
    revalidatePath("/child", "layout");
    return { claimed: result.claimed };
  });
}

export async function submitPuzzleAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const raw = formToObject(formData);
    const sequence = formData.getAll("sequence").map(String);
    const input = parseOrThrow(submitPuzzleSchema, {
      puzzleId: raw.puzzleId,
      answer: { sequence },
    });
    const result = await submitPuzzleAnswer(prisma, ctx, input.puzzleId, input.answer);
    revalidatePath("/child", "layout");
    return result;
  });
}

export async function purchaseItemAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const input = parseOrThrow(purchaseItemSchema, formToObject(formData));
    const result = await purchaseItem(prisma, {
      familyId: ctx.familyId,
      childId: ctx.childId,
      ...input,
    });
    revalidatePath("/child", "layout");
    return { itemKey: result.item.key, replayed: result.replayed };
  });
}

export async function equipCosmeticAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const input = parseOrThrow(equipCosmeticSchema, formToObject(formData));
    const result = await equipCosmetic(prisma, ctx, {
      adventureKey: "pirate",
      slot: input.slot,
      itemKey: input.itemKey === "" ? null : input.itemKey,
    });
    revalidatePath("/child/port", "layout");
    return { equipped: result.equipped };
  });
}

export async function visitLocationAction(_prev: ActionResult<unknown> | null, formData: FormData) {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const input = parseOrThrow(visitLocationSchema, formToObject(formData));
    const result = await visitLocation(prisma, ctx, { adventureKey: "pirate", ...input });
    revalidatePath("/child", "layout");
    return { granted: result.granted };
  });
}

export async function lookOutAction() {
  return runAction(async () => {
    const ctx = await requireChildContext();
    const result = await lookOutFromLighthouse(prisma, ctx, { adventureKey: "pirate" });
    revalidatePath("/child/port", "layout");
    return { newlyLooked: result.newlyLooked };
  });
}
