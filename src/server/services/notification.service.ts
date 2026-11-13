import type { NotificationKind } from "@/generated/prisma/enums";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type { ChildContext, ParentContext } from "@/server/policies/context";

/**
 * In-app notifications (ADR 0009). There is no email or push channel: a row is
 * written in the same transaction as the event it describes and read back by
 * the recipient. Every row has exactly one recipient (parent user or child).
 */

export interface NotificationContent {
  kind: NotificationKind;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
  /** Makes the write idempotent per recipient (a replayed event never doubles up). */
  dedupeKey?: string;
}

/** Notify every active OWNER/GUARDIAN of the family (those who can approve). */
export async function notifyParents(db: DbClient, familyId: string, content: NotificationContent) {
  const members = await db.familyMember.findMany({
    where: { familyId, status: "ACTIVE", role: { in: ["OWNER", "GUARDIAN"] } },
    select: { userId: true },
  });
  if (members.length === 0) return 0;
  const result = await db.notification.createMany({
    data: members.map((m) => ({ familyId, recipientUserId: m.userId, ...content })),
    skipDuplicates: true,
  });
  return result.count;
}

export async function notifyChild(
  db: DbClient,
  familyId: string,
  childId: string,
  content: NotificationContent,
) {
  const result = await db.notification.createMany({
    data: [{ familyId, recipientChildId: childId, ...content }],
    skipDuplicates: true,
  });
  return result.count;
}

type Recipient = ParentContext | ChildContext;

function recipientWhere(ctx: Recipient) {
  return ctx.kind === "parent"
    ? { familyId: ctx.familyId, recipientUserId: ctx.userId }
    : { familyId: ctx.familyId, recipientChildId: ctx.childId };
}

export interface NotificationPage {
  items: Array<{
    id: string;
    kind: NotificationKind;
    title: string;
    body: string | null;
    entityType: string | null;
    entityId: string | null;
    readAt: Date | null;
    createdAt: Date;
  }>;
  nextCursor: string | null;
}

/** Newest first, cursor-paginated. A recipient only ever sees their own rows. */
export async function listNotifications(
  db: DbClient,
  ctx: Recipient,
  options: { cursor?: string; limit?: number; unreadOnly?: boolean } = {},
): Promise<NotificationPage> {
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
  const rows = await db.notification.findMany({
    where: { ...recipientWhere(ctx), ...(options.unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      entityType: true,
      entityId: true,
      readAt: true,
      createdAt: true,
    },
  });
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

export async function countUnread(db: DbClient, ctx: Recipient): Promise<number> {
  return db.notification.count({ where: { ...recipientWhere(ctx), readAt: null } });
}

/** Mark specific notifications (or all, when `ids` is omitted) as read. Idempotent. */
export async function markNotificationsRead(db: DbClient, ctx: Recipient, ids?: string[]) {
  if (ids && ids.length > 100) throw AppError.validation("Too many notifications at once");
  const result = await db.notification.updateMany({
    where: { ...recipientWhere(ctx), readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}
