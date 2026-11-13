import type { DbClient } from "@/lib/db/prisma";
import { pruneOutbox } from "@/lib/email/dev-driver";
import { log } from "@/lib/logging";
import { addDays, localDateToDb, todayIn, type LocalDate } from "@/lib/utils/dates";

import { pruneNotifications } from "./notification.service";
import { reprocessPendingCompletions } from "./progression.service";
import { ensureRoutineRuns } from "./routine.service";
import { ensureTaskOccurrences } from "./task.service";

/** Number of household-local days (starting today) the job materializes. */
export const MATERIALIZE_DAYS = 7;
const FAMILY_PAGE_SIZE = 100;

export interface MaintenanceSummary {
  families: number;
  occurrencesCreated: number;
  runsCreated: number;
  goalAssignmentsExpired: number;
  completionsReprocessed: number;
  outboxPruned: number;
  notificationsPruned: number;
  familyFailures: number;
}

/**
 * Mark ACTIVE goal assignments whose end date is before the family's local today as EXPIRED.
 * Family-scoped and idempotent: the `status = ACTIVE` filter means a re-run changes nothing,
 * and COMPLETED assignments are never touched.
 */
export async function expireGoalAssignments(db: DbClient, familyId: string, today: LocalDate) {
  const result = await db.goalAssignment.updateMany({
    where: { familyId, status: "ACTIVE", endDate: { lt: localDateToDb(today) } },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

/** Materialize the next MATERIALIZE_DAYS local days of occurrences and runs for one family. */
export async function materializeFamilySchedule(
  db: DbClient,
  params: { familyId: string; timezone: string; now?: Date },
) {
  const today = todayIn(params.timezone, params.now);
  const to = addDays(today, MATERIALIZE_DAYS - 1);
  const occurrences = await ensureTaskOccurrences(db, {
    familyId: params.familyId,
    from: today,
    to,
  });
  const runs = await ensureRoutineRuns(db, { familyId: params.familyId, from: today, to });
  return { today, occurrences: occurrences.created, runs: runs.created };
}

/**
 * The scheduled job body. Each family is processed independently (a failure in one family is
 * logged and counted but does not stop the others); families are read in id-ordered pages so the
 * query is never unbounded. Completions are retried globally afterwards.
 */
export async function runScheduledMaintenance(
  db: DbClient,
  options: { now?: Date } = {},
): Promise<MaintenanceSummary> {
  const summary: MaintenanceSummary = {
    families: 0,
    occurrencesCreated: 0,
    runsCreated: 0,
    goalAssignmentsExpired: 0,
    completionsReprocessed: 0,
    outboxPruned: 0,
    notificationsPruned: 0,
    familyFailures: 0,
  };

  let cursor: string | undefined;
  for (;;) {
    const families = await db.family.findMany({
      select: { id: true, timezone: true },
      orderBy: { id: "asc" },
      take: FAMILY_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (families.length === 0) break;
    for (const family of families) {
      summary.families += 1;
      try {
        const done = await materializeFamilySchedule(db, {
          familyId: family.id,
          timezone: family.timezone,
          now: options.now,
        });
        summary.occurrencesCreated += done.occurrences;
        summary.runsCreated += done.runs;
        summary.goalAssignmentsExpired += await expireGoalAssignments(db, family.id, done.today);
      } catch (error) {
        summary.familyFailures += 1;
        log.error("maintenance.family_failed", {
          familyId: family.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }
    cursor = families[families.length - 1].id;
    if (families.length < FAMILY_PAGE_SIZE) break;
  }

  // Retry completions stuck in PENDING/FAILED (bounded by the service's own limit).
  const results = await reprocessPendingCompletions(db, 100);
  summary.completionsReprocessed = results.length;
  summary.outboxPruned = await pruneOutbox(db, 7, options.now);
  summary.notificationsPruned = await pruneNotifications(db, { now: options.now });
  return summary;
}
