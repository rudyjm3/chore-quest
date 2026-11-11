import { describe, expect, it } from "vitest";

import { childPinSchema, createChildSchema, createFamilySchema } from "@/lib/validation/families";
import { createGoalSchema } from "@/lib/validation/goals";
import { parentAdjustmentSchema } from "@/lib/validation/rewards";
import { assignTaskSchema, scheduleSchema } from "@/lib/validation/tasks";

const uuid = "0193b2f0-0000-7000-8000-000000000001";

describe("validation schemas", () => {
  it("requires a valid IANA timezone", () => {
    expect(createFamilySchema.safeParse({ name: "Us", timezone: "Europe/Paris" }).success).toBe(
      true,
    );
    expect(createFamilySchema.safeParse({ name: "Us", timezone: "Mars/Olympus" }).success).toBe(
      false,
    );
  });

  it("PINs are 4–6 digits only", () => {
    expect(childPinSchema.safeParse("1234").success).toBe(true);
    expect(childPinSchema.safeParse("123").success).toBe(false);
    expect(childPinSchema.safeParse("12a4").success).toBe(false);
  });

  it("collects minimal child data", () => {
    const parsed = createChildSchema.safeParse({
      familyId: uuid,
      displayName: "Ava",
      birthYear: 2018,
    });
    expect(parsed.success).toBe(true);
    expect(
      createChildSchema.safeParse({ familyId: uuid, displayName: "Ava", birthYear: 1990 }).success,
    ).toBe(false);
  });

  it("validates schedules", () => {
    expect(scheduleSchema.safeParse({ frequency: "DAILY", startDate: "2026-11-10" }).success).toBe(
      true,
    );
    expect(
      scheduleSchema.safeParse({
        frequency: "SPECIFIC_DAYS",
        daysOfWeek: [],
        startDate: "2026-11-10",
      }).success,
    ).toBe(false);
    expect(
      scheduleSchema.safeParse({ frequency: "WEEKLY", daysOfWeek: [1, 2], startDate: "2026-11-10" })
        .success,
    ).toBe(false);
    expect(
      scheduleSchema.safeParse({
        frequency: "DAILY",
        startDate: "2026-11-10",
        endDate: "2026-11-01",
      }).success,
    ).toBe(false);
    expect(scheduleSchema.safeParse({ frequency: "DAILY", startDate: "2026-02-30" }).success).toBe(
      false,
    );
  });

  it("assignTask needs at least one child", () => {
    const result = assignTaskSchema.safeParse({
      familyId: uuid,
      taskId: uuid,
      childIds: [],
      schedule: { frequency: "DAILY", startDate: "2026-11-10" },
    });
    expect(result.success).toBe(false);
  });

  it("weekly recurrence only for weekly goals", () => {
    expect(
      createGoalSchema.safeParse({
        familyId: uuid,
        title: "x",
        type: "TOTAL_COUNT",
        targetCount: 5,
        recurrence: "WEEKLY",
      }).success,
    ).toBe(false);
    expect(
      createGoalSchema.safeParse({
        familyId: uuid,
        title: "x",
        type: "WEEKLY_COUNT",
        targetCount: 5,
        recurrence: "WEEKLY",
      }).success,
    ).toBe(true);
  });

  it("parent adjustments need a reason, non-zero amount and idempotency key", () => {
    expect(
      parentAdjustmentSchema.safeParse({
        familyId: uuid,
        childId: uuid,
        currency: "POINTS",
        amount: 0,
        reason: "x",
        idempotencyKey: "abcdefgh",
      }).success,
    ).toBe(false);
    expect(
      parentAdjustmentSchema.safeParse({
        familyId: uuid,
        childId: uuid,
        currency: "POINTS",
        amount: 5,
        reason: "Bonus",
        idempotencyKey: "abcdefgh",
      }).success,
    ).toBe(true);
  });
});
