import "server-only";

import { cookies } from "next/headers";

import { getParentSession } from "@/lib/auth/session";
import { resolveChildSession } from "@/lib/auth/child-session";
import { readChildSessionToken } from "@/lib/auth/child-session-cookie";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type { FamilyRole } from "@/generated/prisma/enums";

/**
 * Request contexts are the only way services learn "who is acting".
 * A parent context and a child context are deliberately different types so a
 * function that needs one cannot accidentally accept the other.
 */
export interface ParentContext {
  kind: "parent";
  userId: string;
  userName: string;
  familyId: string;
  familyName: string;
  timezone: string;
  weekStartsOn: number;
  role: FamilyRole;
  membershipId: string;
}

export interface ChildContext {
  kind: "child";
  childId: string;
  childName: string;
  familyId: string;
  sessionId: string;
}

export const ACTIVE_FAMILY_COOKIE = "cq_family";

/** Signed-in parent without a family yet (needs onboarding). */
export interface ParentWithoutFamily {
  kind: "parent-no-family";
  userId: string;
  userName: string;
}

export async function getParentContext(): Promise<ParentContext | ParentWithoutFamily | null> {
  const session = await getParentSession();
  if (!session) return null;

  const memberships = await prisma.familyMember.findMany({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { family: { select: { id: true, name: true, timezone: true, weekStartsOn: true } } },
    orderBy: { joinedAt: "asc" },
  });
  if (memberships.length === 0) {
    return { kind: "parent-no-family", userId: session.user.id, userName: session.user.name };
  }

  const preferred = (await cookies()).get(ACTIVE_FAMILY_COOKIE)?.value;
  const membership = memberships.find((m) => m.familyId === preferred) ?? memberships[0];

  return {
    kind: "parent",
    userId: session.user.id,
    userName: session.user.name,
    familyId: membership.familyId,
    familyName: membership.family.name,
    timezone: membership.family.timezone,
    weekStartsOn: membership.family.weekStartsOn,
    role: membership.role,
    membershipId: membership.id,
  };
}

/** Throws UNAUTHORIZED / FORBIDDEN instead of returning null. Use in actions. */
export async function requireParentContext(): Promise<ParentContext> {
  const ctx = await getParentContext();
  if (!ctx) throw AppError.unauthorized();
  if (ctx.kind === "parent-no-family") throw AppError.forbidden("Create or join a family first");
  return ctx;
}

export async function getChildContext(): Promise<ChildContext | null> {
  const token = await readChildSessionToken();
  if (!token) return null;
  const session = await resolveChildSession(prisma, token);
  if (!session) return null;
  return {
    kind: "child",
    childId: session.childId,
    childName: session.child.displayName,
    familyId: session.familyId,
    sessionId: session.id,
  };
}

export async function requireChildContext(): Promise<ChildContext> {
  const ctx = await getChildContext();
  if (!ctx) throw AppError.unauthorized("Child sign-in required");
  return ctx;
}
