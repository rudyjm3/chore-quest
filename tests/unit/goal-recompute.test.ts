import { describe, expect, it } from "vitest";

import { effectiveTarget, recomputeProgress } from "@/features/goals/progress";

describe("recomputeProgress", () => {
  it("counts every row for counting goals", () => {
    const result = recomputeProgress("TOTAL_COUNT", 3, [
      { localDate: "2026-11-10", countedForStreak: false },
      { localDate: "2026-11-10", countedForStreak: false },
      { localDate: "2026-11-12", countedForStreak: false },
    ]);
    expect(result.progressCount).toBe(3);
    expect(result.completed).toBe(true);
    expect(result.lastContributionDate).toBe("2026-11-12");
  });

  it("replays only streak-credited rows for consecutive-day goals", () => {
    const result = recomputeProgress("CONSECUTIVE_DAYS", 10, [
      { localDate: "2026-11-10", countedForStreak: true },
      { localDate: "2026-11-10", countedForStreak: false },
      { localDate: "2026-11-11", countedForStreak: true },
      { localDate: "2026-11-08", countedForStreak: false },
      { localDate: "2026-11-14", countedForStreak: true },
    ]);
    expect(result).toMatchObject({ currentStreak: 1, bestStreak: 2, progressCount: 1 });
  });

  it("is empty-safe", () => {
    expect(recomputeProgress("TOTAL_COUNT", 3, [])).toMatchObject({
      progressCount: 0,
      completed: false,
      lastContributionDate: null,
    });
  });

  it("effectiveTarget prefers the override", () => {
    expect(effectiveTarget(5, null)).toBe(5);
    expect(effectiveTarget(5, 2)).toBe(2);
  });
});
