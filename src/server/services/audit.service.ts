import type { ActorType } from "@/generated/prisma/enums";
import type { DbClient } from "@/lib/db/prisma";

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
