# Dates, time zones and recurrence

## Rules

1. **Instants are UTC.** Every `DateTime` column (`createdAt`, `approvedAt`, `dueAt`, …) is `timestamptz`.
2. **Each family has an IANA timezone** (`family.timezone`) and a week start (`family.weekStartsOn`, 0 = Sunday).
3. **Household-local dates** (`LocalDate`, `YYYY-MM-DD`) drive everything calendar-shaped: task occurrences,
   routine runs, goal windows, streaks, weekly periods. They are stored as `date` columns (`@db.Date`).
4. The local date of a verified completion is the local date of the **occurrence/run it verifies**, not the
   instant the parent pressed Approve. Approving yesterday's chore today still counts for yesterday.
5. Conversions use `Intl.DateTimeFormat` (`src/lib/utils/dates.ts`); no timezone library is needed.

## Helpers (`src/lib/utils/dates.ts`)

| Function                                                     | Purpose                                                                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `toLocalDate(instant, tz)`                                   | Calendar date of an instant in a zone                                                                                                                  |
| `startOfLocalDay / endOfLocalDay(localDate, tz)`             | DST-correct day boundaries as UTC instants (23/25-hour days handled)                                                                                   |
| `localDateTimeToInstant(localDate, "HH:mm", tz)`             | Due times. Non-existent times (spring-forward gap) resolve to the shifted-forward instant; ambiguous times (fall-back) resolve to the first occurrence |
| `localDateToDb / dbToLocalDate`                              | Mapping to/from Prisma `@db.Date` values (UTC midnight `Date`s)                                                                                        |
| `addDays / diffDays / dayOfWeek`                             | Calendar arithmetic without DST pitfalls                                                                                                               |
| `startOfWeek / endOfWeek / weekKey(localDate, weekStartsOn)` | Household weeks; `weekKey` = `week:<startDate>`                                                                                                        |
| `todayIn(tz)`                                                | Today's local date for a family                                                                                                                        |

## Recurrence (`src/features/tasks/recurrence.ts`)

- `ONCE`: only on `startDate`.
- `DAILY`: every day from `startDate` to `endDate` (inclusive).
- `WEEKLY`: one weekday (`daysOfWeek` has exactly one entry).
- `SPECIFIC_DAYS`: any subset of weekdays.
- Occurrences are materialized by `ensureTaskOccurrences` / `ensureRoutineRuns` for a date window
  (idempotent via unique `(assignmentId, localDate)`). Editing an assignment affects only occurrences generated
  afterwards; existing rows keep their `pointsSnapshot`.

## Goals

- `WEEKLY_COUNT`: pinned to the household week containing the assignment's start; with `recurrence = WEEKLY`
  a contribution in a later week creates the next period assignment lazily (`periodKey = week:<start>`).
- `CONSECUTIVE_DAYS`: one streak advance per local date (partial unique index). A gap resets `currentStreak`;
  `bestStreak` is kept. Contributions processed out of order (older than the last) are recorded but do not
  change the streak. A full recomputation job from `goal_contribution` rows is on the roadmap.
- Goals whose window has passed are ignored for new contributions; an expiry job will mark them `EXPIRED`.

## Daylight saving time

Unit tests in `tests/unit/dates.test.ts` cover the US spring-forward (23-hour day, non-existent 02:30) and
fall-back (25-hour day) transitions, plus a zone without DST.
