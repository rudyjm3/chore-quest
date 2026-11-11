import { describe, expect, it } from "vitest";

import { applyContribution, completionMatchesGoal, goalPeriodKey } from "@/features/goals/progress";

const base = { progressCount: 0, currentStreak: 0, bestStreak: 0, lastContributionDate: null };

describe("goal progress", () => {
  it("counts every contribution for TOTAL_COUNT and completes at target", () => {
    let state = applyContribution("TOTAL_COUNT", 2, base, "2026-11-10");
    expect(state.progressCount).toBe(1);
    expect(state.completed).toBe(false);
    state = applyContribution("TOTAL_COUNT", 2, state, "2026-11-10");
    expect(state.progressCount).toBe(2);
    expect(state.completed).toBe(true);
  });

  it("CONSECUTIVE_DAYS counts a day once even with two completions", () => {
    let state = applyContribution("CONSECUTIVE_DAYS", 3, base, "2026-11-10");
    expect(state.currentStreak).toBe(1);
    expect(state.countedForStreak).toBe(true);
    const sameDay = applyContribution("CONSECUTIVE_DAYS", 3, state, "2026-11-10");
    expect(sameDay.currentStreak).toBe(1);
    expect(sameDay.countedForStreak).toBe(false);
    expect(sameDay.counted).toBe(false);
    state = applyContribution("CONSECUTIVE_DAYS", 3, sameDay, "2026-11-11");
    state = applyContribution("CONSECUTIVE_DAYS", 3, state, "2026-11-12");
    expect(state.currentStreak).toBe(3);
    expect(state.completed).toBe(true);
  });

  it("a missed day resets the streak but keeps the best streak", () => {
    let state = applyContribution("CONSECUTIVE_DAYS", 5, base, "2026-11-10");
    state = applyContribution("CONSECUTIVE_DAYS", 5, state, "2026-11-11");
    state = applyContribution("CONSECUTIVE_DAYS", 5, state, "2026-11-13");
    expect(state.currentStreak).toBe(1);
    expect(state.bestStreak).toBe(2);
  });

  it("an out-of-order (older) contribution never extends a streak", () => {
    const state = applyContribution("CONSECUTIVE_DAYS", 5, base, "2026-11-11");
    const older = applyContribution("CONSECUTIVE_DAYS", 5, state, "2026-11-10");
    expect(older.counted).toBe(false);
    expect(older.currentStreak).toBe(1);
  });

  it("matches eligibility filters", () => {
    const facts = {
      sourceType: "TASK_OCCURRENCE" as const,
      taskId: "t1",
      taskCategory: "CHORE" as const,
      routineId: null,
      localDate: "2026-11-10",
    };
    const anyGoal = {
      type: "TOTAL_COUNT" as const,
      filterTaskId: null,
      filterRoutineId: null,
      filterCategory: null,
      filterSourceType: null,
    };
    expect(completionMatchesGoal(anyGoal, facts)).toBe(true);
    expect(completionMatchesGoal({ ...anyGoal, filterTaskId: "t2" }, facts)).toBe(false);
    expect(completionMatchesGoal({ ...anyGoal, filterCategory: "HYGIENE" }, facts)).toBe(false);
    expect(completionMatchesGoal({ ...anyGoal, type: "ROUTINE_CONSISTENCY" }, facts)).toBe(false);
    expect(
      completionMatchesGoal(
        { ...anyGoal, type: "ROUTINE_CONSISTENCY", filterRoutineId: "r1" },
        { ...facts, sourceType: "ROUTINE_RUN", routineId: "r1" },
      ),
    ).toBe(true);
  });

  it("only weekly goals get a period key", () => {
    expect(goalPeriodKey("WEEKLY_COUNT", "week:2026-11-09")).toBe("week:2026-11-09");
    expect(goalPeriodKey("TOTAL_COUNT", "week:2026-11-09")).toBe("");
  });
});
