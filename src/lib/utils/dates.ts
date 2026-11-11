/**
 * Household-local date utilities.
 *
 * Rules (see docs/database/TIMEZONES.md):
 *  - Instants (timestamps) are always UTC `Date` objects.
 *  - A "local date" is the calendar date in the family's IANA timezone and is
 *    represented as an ISO string "YYYY-MM-DD" (type LocalDate) in code and as
 *    a `@db.Date` column in PostgreSQL.
 *  - Conversions use the Intl API so DST transitions are handled by the
 *    platform's timezone database. No extra dependency is needed.
 */

export type LocalDate = string; // "YYYY-MM-DD"

const LOCAL_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string" || !LOCAL_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function assertLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) throw new RangeError(`Invalid local date: ${value}`);
  return value;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(instant: Date, timeZone: string): WallClock {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
  };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** The calendar date of `instant` in `timeZone`. */
export function toLocalDate(instant: Date, timeZone: string): LocalDate {
  const w = wallClock(instant, timeZone);
  return `${pad(w.year, 4)}-${pad(w.month)}-${pad(w.day)}`;
}

/** Local wall-clock time "HH:mm" of `instant` in `timeZone`. */
export function toLocalTime(instant: Date, timeZone: string): string {
  const w = wallClock(instant, timeZone);
  return `${pad(w.hour)}:${pad(w.minute)}`;
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (east positive). */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const w = wallClock(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  const truncated = Math.floor(instant.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60_000);
}

/**
 * UTC instant at which the given local wall-clock time happens in `timeZone`.
 * DST-safe: iterates on the offset so a time inside a transition resolves to
 * a real instant (for a non-existent time, the later interpretation wins).
 */
export function localDateTimeToInstant(localDate: LocalDate, time: string, timeZone: string): Date {
  const [y, m, d] = assertLocalDate(localDate).split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);
  const firstOffset = timeZoneOffsetMinutes(new Date(naive), timeZone);
  let instant = naive - firstOffset * 60_000;
  const secondOffset = timeZoneOffsetMinutes(new Date(instant), timeZone);
  if (secondOffset !== firstOffset) {
    // Near a transition: only accept the re-computed instant if it really
    // shows the requested wall-clock time (otherwise the time does not exist
    // and we keep the shifted-forward instant).
    const candidate = naive - secondOffset * 60_000;
    if (timeZoneOffsetMinutes(new Date(candidate), timeZone) === secondOffset) instant = candidate;
  }
  return new Date(instant);
}

/** The instant the local day starts (local midnight) in `timeZone`. */
export function startOfLocalDay(localDate: LocalDate, timeZone: string): Date {
  return localDateTimeToInstant(localDate, "00:00", timeZone);
}

/** Exclusive end of the local day: start of the next local day. */
export function endOfLocalDay(localDate: LocalDate, timeZone: string): Date {
  return startOfLocalDay(addDays(localDate, 1), timeZone);
}

/** Convert a LocalDate into the `Date` Prisma expects for a `@db.Date` column. */
export function localDateToDb(localDate: LocalDate): Date {
  const [y, m, d] = assertLocalDate(localDate).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Convert a `@db.Date` value read from Prisma back into a LocalDate. */
export function dbToLocalDate(value: Date): LocalDate {
  return `${pad(value.getUTCFullYear(), 4)}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
}

export function addDays(localDate: LocalDate, days: number): LocalDate {
  const base = localDateToDb(localDate);
  base.setUTCDate(base.getUTCDate() + days);
  return dbToLocalDate(base);
}

/** Whole days from `a` to `b` (positive when b is after a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((localDateToDb(b).getTime() - localDateToDb(a).getTime()) / 86_400_000);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(localDate: LocalDate): number {
  return localDateToDb(localDate).getUTCDay();
}

/** First day of the household week containing `localDate`. */
export function startOfWeek(localDate: LocalDate, weekStartsOn: number): LocalDate {
  const dow = dayOfWeek(localDate);
  const delta = (dow - weekStartsOn + 7) % 7;
  return addDays(localDate, -delta);
}

export function endOfWeek(localDate: LocalDate, weekStartsOn: number): LocalDate {
  return addDays(startOfWeek(localDate, weekStartsOn), 6);
}

/** Stable key for the household week, e.g. "week:2026-11-09". */
export function weekKey(localDate: LocalDate, weekStartsOn: number): string {
  return `week:${startOfWeek(localDate, weekStartsOn)}`;
}

/** Today's local date for a household. */
export function todayIn(timeZone: string, now: Date = new Date()): LocalDate {
  return toLocalDate(now, timeZone);
}

export function isWithinRange(
  localDate: LocalDate,
  start: LocalDate,
  end: LocalDate | null | undefined,
): boolean {
  if (localDate < start) return false;
  if (end && localDate > end) return false;
  return true;
}
