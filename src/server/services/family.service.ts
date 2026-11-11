import { randomInt } from "node:crypto";

import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type { CreateFamilyInput, UpdateFamilySettingsInput } from "@/lib/validation/families";
import type { ParentContext } from "@/server/policies/context";
import { assertFamilyScope, assertPermission } from "@/server/policies/family-access";

import { recordAudit } from "./audit.service";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I

export function generateFamilyCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i += 1) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Create a household with the current user as OWNER. */
export async function createFamily(db: DbClient, userId: string, input: CreateFamilyInput) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateFamilyCode();
    const existing = await db.family.findUnique({
      where: { childLoginCode: code },
      select: { id: true },
    });
    if (existing) continue;
    const family = await db.family.create({
      data: {
        name: input.name,
        timezone: input.timezone,
        weekStartsOn: input.weekStartsOn,
        childLoginCode: code,
        createdById: userId,
        settings: { create: {} },
        members: { create: { userId, role: "OWNER" } },
      },
      include: { settings: true, members: true },
    });
    await recordAudit(db, {
      familyId: family.id,
      actorType: "PARENT",
      actorUserId: userId,
      action: "family.create",
      entityType: "Family",
      entityId: family.id,
    });
    return family;
  }
  throw AppError.conflict("Could not allocate a unique family code; please retry");
}

export async function getFamilyOverview(db: DbClient, ctx: ParentContext) {
  const family = await db.family.findUnique({
    where: { id: ctx.familyId },
    include: {
      settings: true,
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      children: { where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!family) throw AppError.notFound("Family");
  return family;
}

export async function updateFamilySettings(
  db: DbClient,
  ctx: ParentContext,
  input: UpdateFamilySettingsInput,
) {
  assertFamilyScope(ctx, input.familyId);
  assertPermission(ctx, "canManageFamily");
  const family = await db.family.update({
    where: { id: input.familyId },
    data: {
      name: input.name,
      timezone: input.timezone,
      weekStartsOn: input.weekStartsOn,
      settings: {
        upsert: {
          create: {
            defaultApprovalPolicy: input.defaultApprovalPolicy,
            allowChildSelfSignIn: input.allowChildSelfSignIn,
          },
          update: {
            defaultApprovalPolicy: input.defaultApprovalPolicy,
            allowChildSelfSignIn: input.allowChildSelfSignIn,
          },
        },
      },
    },
    include: { settings: true },
  });
  await recordAudit(db, {
    familyId: family.id,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "family.settings.update",
    entityType: "Family",
    entityId: family.id,
    metadata: { fields: Object.keys(input).filter((k) => k !== "familyId") },
  });
  return family;
}

/** Add another adult to the household. Invitations by email are a later milestone. */
export async function addGuardian(db: DbClient, ctx: ParentContext, userId: string) {
  assertPermission(ctx, "canManageMembers");
  const member = await db.familyMember.upsert({
    where: { familyId_userId: { familyId: ctx.familyId, userId } },
    create: { familyId: ctx.familyId, userId, role: "GUARDIAN" },
    update: { status: "ACTIVE" },
  });
  await recordAudit(db, {
    familyId: ctx.familyId,
    actorType: "PARENT",
    actorUserId: ctx.userId,
    action: "family.member.add",
    entityType: "FamilyMember",
    entityId: member.id,
  });
  return member;
}
