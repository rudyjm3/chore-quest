import { createHmac, randomBytes } from "node:crypto";

import type { DbClient } from "@/lib/db/prisma";
import { getServerEnv } from "@/lib/env";

/**
 * Family-managed child sessions.
 *
 * A child never has a Better Auth account. After a successful family-code +
 * PIN check (or a parent starting the session from their own device) we mint
 * an opaque random token, store only its HMAC in `child_session`, and set it
 * as an httpOnly cookie that is distinct from the parent session cookie
 * (cookie helpers live in child-session-cookie.ts so this module stays free of
 * Next.js imports and can be used by services, seeds and tests).
 */
export const CHILD_SESSION_COOKIE = "cq_child_session";

export function hashChildToken(token: string): string {
  return createHmac("sha256", getServerEnv().CHILD_SESSION_SECRET).update(token).digest("hex");
}

export function generateChildToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface IssueChildSessionOptions {
  familyId: string;
  childId: string;
  issuedByUserId?: string | null;
  ttlMinutes: number;
}

export async function issueChildSession(db: DbClient, options: IssueChildSessionOptions) {
  const token = generateChildToken();
  const expiresAt = new Date(Date.now() + options.ttlMinutes * 60_000);
  const session = await db.childSession.create({
    data: {
      familyId: options.familyId,
      childId: options.childId,
      issuedByUserId: options.issuedByUserId ?? null,
      tokenHash: hashChildToken(token),
      expiresAt,
    },
  });
  return { token, session };
}

/** Resolve a token to a live session row, or null. Touches `lastSeenAt` at most every 5 minutes. */
export async function resolveChildSession(db: DbClient, token: string) {
  const session = await db.childSession.findUnique({
    where: { tokenHash: hashChildToken(token) },
    include: { child: { select: { id: true, familyId: true, displayName: true, status: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) return null;
  if (session.child.status !== "ACTIVE") return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.childSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return session;
}
