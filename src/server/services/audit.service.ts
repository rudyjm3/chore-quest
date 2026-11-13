import type { ActorType } from "@/generated/prisma/enums";
import { isValidActionPrefix, summarizeAudit } from "@/features/audit/summary";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { endOfLocalDay, startOfLocalDay, type LocalDate } from "@/lib/utils/dates";
import type { ParentContext } from "@/server/policies/context";
import { assertPermission } from "@/server/policies/family-access";

export interface AuditInput {
  familyId: string;
  actorType: ActorType;
  actorUserId?: string | null;
  actorChildId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

/** Append an audit record. Call inside the same transaction as the change it describes. */
export async function recordAudit(db: DbClient, input: AuditInput) {
  return db.auditLog.create({
    data: {
      familyId: input.familyId,
      actorType: input.actorType,
      actorUserId: input.actorUserId ?? null,
      actorChildId: input.actorChildId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined,
    },
  });
}

export interface AuditEntryView {
  id: string;
  createdAt: Date;
  action: string;
  actorLabel: string;
  summary: string;
}

/**
 * Cursor-paginated audit log for OWNER and GUARDIAN. Scoped by family, newest first, optionally
 * filtered by an action prefix ("reward" matches "reward.adjust") and an inclusive household-local
 * date range. Only a readable summary is returned: raw metadata never leaves the service.
 */
export async function listAuditLog(
  db: DbClient,
  ctx: ParentContext,
  options: {
    prefix?: string;
    from?: LocalDate;
    to?: LocalDate;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<{ entries: AuditEntryView[]; nextCursor: string | null }> {
  assertPermission(ctx, "canApprove");
  if (options.prefix && !isValidActionPrefix(options.prefix)) {
    throw AppError.validation("Unknown audit filter");
  }
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  const createdAt =
    options.from || options.to
      ? {
          ...(options.from ? { gte: startOfLocalDay(options.from, ctx.timezone) } : {}),
          ...(options.to ? { lt: endOfLocalDay(options.to, ctx.timezone) } : {}),
        }
      : undefined;
  const rows = await db.auditLog.findMany({
    where: {
      familyId: ctx.familyId,
      ...(options.prefix
        ? {
            OR: [{ action: options.prefix }, { action: { startsWith: `${options.prefix}.` } }],
          }
        : {}),
      ...(createdAt ? { createdAt } : {}),
    },
    include: {
      actorUser: { select: { name: true } },
      actorChild: { select: { displayName: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return {
    entries: page.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      action: row.action,
      actorLabel:
        row.actorType === "SYSTEM"
          ? "Chore Quests"
          : (row.actorUser?.name ?? row.actorChild?.displayName ?? "Someone"),
      summary: summarizeAudit(
        row.action,
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? (row.metadata as Record<string, unknown>)
          : null,
      ),
    })),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}
