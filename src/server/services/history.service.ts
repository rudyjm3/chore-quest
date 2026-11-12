import { decodeHistoryCursor, encodeHistoryCursor } from "@/features/history/cursor";
import type { DbClient } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { dbToLocalDate, localDateToDb, type LocalDate } from "@/lib/utils/dates";
import { requireChildInFamily } from "@/server/policies/family-access";

export const HISTORY_PAGE_SIZE = 20;
export const HISTORY_MAX_PAGE_SIZE = 50;

export interface HistoryParams {
  familyId: string;
  /** Required for child actors; optional filter for parents. */
  childId?: string;
  from?: LocalDate;
  to?: LocalDate;
  cursor?: string | null;
  limit?: number;
}

export interface HistoryItem {
  id: string;
  childId: string;
  childName: string;
  localDate: LocalDate;
  kind: "TASK" | "ROUTINE";
  title: string;
  points: number;
  completedAt: Date;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

/**
 * Verified-completion history, newest first, keyset-paginated (never unbounded: the page size is
 * clamped to HISTORY_MAX_PAGE_SIZE). Always scoped by familyId (and childId when given).
 */
export async function listActivityHistory(
  db: DbClient,
  params: HistoryParams,
): Promise<HistoryPage> {
  if (params.from && params.to && params.from > params.to) {
    throw AppError.validation("The start date must be on or before the end date");
  }
  if (params.childId) await requireChildInFamily(db, params.familyId, params.childId);
  const limit = Math.min(Math.max(params.limit ?? HISTORY_PAGE_SIZE, 1), HISTORY_MAX_PAGE_SIZE);
  const cursor = decodeHistoryCursor(params.cursor);

  const rows = await db.activityCompletion.findMany({
    where: {
      familyId: params.familyId,
      ...(params.childId ? { childId: params.childId } : {}),
      ...(params.from || params.to
        ? {
            localDate: {
              ...(params.from ? { gte: localDateToDb(params.from) } : {}),
              ...(params.to ? { lte: localDateToDb(params.to) } : {}),
            },
          }
        : {}),
      ...(cursor
        ? {
            OR: [
              { localDate: { lt: localDateToDb(cursor.localDate) } },
              { localDate: localDateToDb(cursor.localDate), id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ localDate: "desc" }, { id: "desc" }],
    take: limit + 1,
    include: {
      child: { select: { displayName: true } },
      taskOccurrence: { select: { assignment: { select: { task: { select: { title: true } } } } } },
      routineRun: {
        select: { assignment: { select: { routine: { select: { name: true } } } } },
      },
    },
  });

  const pageRows = rows.slice(0, limit);
  const items = pageRows.map((row): HistoryItem => {
    const isTask = row.sourceType === "TASK_OCCURRENCE";
    return {
      id: row.id,
      childId: row.childId,
      childName: row.child.displayName,
      localDate: dbToLocalDate(row.localDate),
      kind: isTask ? "TASK" : "ROUTINE",
      title: isTask
        ? (row.taskOccurrence?.assignment.task.title ?? "Task")
        : (row.routineRun?.assignment.routine.name ?? "Routine"),
      points: row.pointsAwarded,
      completedAt: row.completedAt,
    };
  });
  const last = pageRows[pageRows.length - 1];
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? encodeHistoryCursor({ localDate: dbToLocalDate(last.localDate), id: last.id })
        : null,
  };
}
