import { describe, expect, it } from "vitest";

import { effectivePoints, occursOn, scheduledDatesBetween } from "@/features/tasks/recurrence";

describe("recurrence", () => {
  it("ONCE occurs only on its start date", () => {
    const s = { frequency: "ONCE" as const, daysOfWeek: [], startDate: "2026-11-10" };
    expect(occursOn(s, "2026-11-10")).toBe(true);
    expect(occursOn(s, "2026-11-11")).toBe(false);
  });

  it("DAILY respects start and end dates", () => {
    const s = {
      frequency: "DAILY" as const,
      daysOfWeek: [],
      startDate: "2026-11-10",
      endDate: "2026-11-12",
    };
    expect(scheduledDatesBetween(s, "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
    ]);
  });

  it("SPECIFIC_DAYS picks the matching weekdays", () => {
    // 2026-11-09 is Monday.
    const s = { frequency: "SPECIFIC_DAYS" as const, daysOfWeek: [1, 3], startDate: "2026-11-09" };
    expect(scheduledDatesBetween(s, "2026-11-09", "2026-11-15")).toEqual([
      "2026-11-09",
      "2026-11-11",
    ]);
  });

  it("WEEKLY produces one occurrence per week", () => {
    const s = { frequency: "WEEKLY" as const, daysOfWeek: [6], startDate: "2026-11-01" };
    expect(scheduledDatesBetween(s, "2026-11-01", "2026-11-30")).toEqual([
      "2026-11-07",
      "2026-11-14",
      "2026-11-21",
      "2026-11-28",
    ]);
  });

  it("caps generation to a year", () => {
    const s = { frequency: "DAILY" as const, daysOfWeek: [], startDate: "2020-01-01" };
    expect(scheduledDatesBetween(s, "2020-01-01", "2030-01-01").length).toBe(366);
  });

  it("assignment override wins over task points", () => {
    expect(effectivePoints(5, null)).toBe(5);
    expect(effectivePoints(5, 12)).toBe(12);
    expect(effectivePoints(5, 0)).toBe(0);
  });
});
