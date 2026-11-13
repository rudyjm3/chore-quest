import type { ActivitySourceType, GoalType, TaskCategory } from "@/generated/prisma/enums";
import { addDays, type LocalDate } from "@/lib/utils/dates";

/** Subset of a verified completion the goal engine needs. */
export interface CompletionFacts {
  sourceType: ActivitySourceType;
  taskId: string | null;
  taskCategory: TaskCategory | null;
  routineId: string | null;
  localDate: LocalDate;
}

export interface GoalFilters {
  type: GoalType;
  filterTaskId: string | null;
  filterRoutineId: string | null;
  filterCategory: TaskCategory | null;
  filterSourceType: ActivitySourceType | null;
}

/** Does a completion satisfy the goal's eligibility filters? */
export function completionMatchesGoal(goal: GoalFilters, facts: CompletionFacts): boolean {
  if (goal.type === "ROUTINE_CONSISTENCY") {
    if (facts.sourceType !== "ROUTINE_RUN") return false;
    if (goal.filterRoutineId && facts.routineId !== goal.filterRoutineId) return false;
    return true;
  }
  if (goal.filterSourceType && facts.sourceType !== goal.filterSourceType) return false;
  if (goal.filterTaskId && facts.taskId !== goal.filterTaskId) return false;
  if (goal.filterRoutineId && facts.routineId !== goal.filterRoutineId) return false;
  if (goal.filterCategory && facts.taskCategory !== goal.filterCategory) return false;
  return true;
}

export interface ProgressState {
  progressCount: number;
  currentStreak: number;
  bestStreak: number;
  lastContributionDate: LocalDate | null;
}

export interface ProgressUpdate extends ProgressState {
  /** True when this contribution advanced a consecutive-day streak. */
  countedForStreak: boolean;
  /** True when the contribution changed progress at all. */
  counted: boolean;
  completed: boolean;
}

/**
 * Apply one eligible contribution on `localDate` to a goal's progress state.
 *
 * Counting goals (TOTAL_COUNT, WEEKLY_COUNT, ROUTINE_CONSISTENCY, CUSTOM_MILESTONE)
 * increment once per contribution. Consecutive-day goals count at most one
 * contribution per local date: a second completion on the same day is
 * recorded as a contribution but does not advance the streak.
 *
 * Contributions are expected in chronological order; a contribution dated
 * before the last one is counted (for count goals) but never extends a streak.
 */
export function applyContribution(
  type: GoalType,
  targetCount: number,
  state: ProgressState,
  localDate: LocalDate,
): ProgressUpdate {
  if (type === "CONSECUTIVE_DAYS") {
    const last = state.lastContributionDate;
    if (last === localDate) {
      return { ...state, countedForStreak: false, counted: false, completed: false };
    }
    if (last && localDate < last) {
      // Out-of-order approval: do not rewrite the streak.
      return { ...state, countedForStreak: false, counted: false, completed: false };
    }
    const continues = last !== null && addDays(last, 1) === localDate;
    const currentStreak = continues ? state.currentStreak + 1 : 1;
    const bestStreak = Math.max(state.bestStreak, currentStreak);
    return {
      progressCount: currentStreak,
      currentStreak,
      bestStreak,
      lastContributionDate: localDate,
      countedForStreak: true,
      counted: true,
      completed: currentStreak >= targetCount,
    };
  }

  const progressCount = state.progressCount + 1;
  const last = state.lastContributionDate;
  const lastContributionDate = !last || localDate > last ? localDate : last;
  return {
    progressCount,
    currentStreak: state.currentStreak,
    bestStreak: state.bestStreak,
    lastContributionDate,
    countedForStreak: false,
    counted: true,
    completed: progressCount >= targetCount,
  };
}

/** Period key for a goal assignment: "" unless the goal is a weekly recurrence. */
export function goalPeriodKey(type: GoalType, weekKey: string): string {
  return type === "WEEKLY_COUNT" ? weekKey : "";
}

/** One persisted contribution, in the order the pipeline processed it. */
export interface ContributionFact {
  localDate: LocalDate;
  countedForStreak: boolean;
}

/** The target that applies to an assignment: its own override, else the goal's. */
export function effectiveTarget(goalTarget: number, targetOverride: number | null): number {
  return targetOverride ?? goalTarget;
}

/**
 * Rebuild an assignment's cached counters from its contribution rows (the source of truth).
 *
 * `contributions` must be in processing order (createdAt, id). Counting goals count every
 * row. Consecutive-day goals replay only the rows that advanced the streak: same-day repeats
 * and out-of-order approvals were stored with `countedForStreak = false` and never changed
 * the counters, so skipping them reproduces exactly what the live pipeline computed.
 */
export function recomputeProgress(
  type: GoalType,
  targetCount: number,
  contributions: ContributionFact[],
): ProgressState & { completed: boolean } {
  let state: ProgressState = {
    progressCount: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastContributionDate: null,
  };
  let completed = false;
  for (const c of contributions) {
    if (type === "CONSECUTIVE_DAYS" && !c.countedForStreak) continue;
    const next = applyContribution(type, targetCount, state, c.localDate);
    if (!next.counted) continue;
    state = {
      progressCount: next.progressCount,
      currentStreak: next.currentStreak,
      bestStreak: next.bestStreak,
      lastContributionDate: next.lastContributionDate,
    };
    completed = completed || next.completed;
  }
  return { ...state, completed };
}
