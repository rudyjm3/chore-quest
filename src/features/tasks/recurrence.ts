import type { RecurrenceFrequency } from "@/generated/prisma/enums";
import { addDays, dayOfWeek, isWithinRange, type LocalDate } from "@/lib/utils/dates";

/** The schedule shape shared by task and routine assignments. */
export interface Schedule {
  frequency: RecurrenceFrequency;
  daysOfWeek: number[];
  startDate: LocalDate;
  endDate?: LocalDate | null;
}

/** Does this schedule produce an occurrence on `localDate`? */
export function occursOn(schedule: Schedule, localDate: LocalDate): boolean {
  if (!isWithinRange(localDate, schedule.startDate, schedule.endDate)) return false;
  switch (schedule.frequency) {
    case "ONCE":
      return localDate === schedule.startDate;
    case "DAILY":
      return true;
    case "WEEKLY":
    case "SPECIFIC_DAYS":
      return schedule.daysOfWeek.includes(dayOfWeek(localDate));
    default:
      return false;
  }
}

/** All local dates in [from, to] (inclusive) on which the schedule occurs. Capped to 366 days. */
export function scheduledDatesBetween(
  schedule: Schedule,
  from: LocalDate,
  to: LocalDate,
): LocalDate[] {
  const dates: LocalDate[] = [];
  let cursor = from < schedule.startDate ? schedule.startDate : from;
  const limit = schedule.endDate && schedule.endDate < to ? schedule.endDate : to;
  let guard = 0;
  while (cursor <= limit && guard < 366) {
    if (occursOn(schedule, cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

/** Effective points for an occurrence generated from an assignment. */
export function effectivePoints(
  taskPoints: number,
  pointsOverride: number | null | undefined,
): number {
  return pointsOverride ?? taskPoints;
}
