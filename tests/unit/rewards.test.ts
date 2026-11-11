import { describe, expect, it } from "vitest";

import {
  applyLedgerAmount,
  pointsForOccurrence,
  pointsForRoutineRun,
} from "@/features/rewards/calculations";
import { sourceKeys } from "@/lib/utils/source-keys";

describe("reward calculations", () => {
  it("credits and debits a balance", () => {
    expect(applyLedgerAmount(10, 5)).toBe(15);
    expect(applyLedgerAmount(10, -10)).toBe(0);
  });

  it("refuses negative balances and zero amounts", () => {
    expect(() => applyLedgerAmount(5, -6)).toThrowError(/Insufficient/);
    expect(() => applyLedgerAmount(5, 0)).toThrowError(/non-zero/);
    expect(() => applyLedgerAmount(5, 1.5)).toThrowError(/non-zero integer/);
  });

  it("never awards negative points", () => {
    expect(pointsForOccurrence(-3)).toBe(0);
    expect(pointsForRoutineRun(7)).toBe(7);
  });

  it("source keys are distinct per source and currency", () => {
    const keys = new Set([
      sourceKeys.activityReward("a", "POINTS"),
      sourceKeys.activityReward("a", "COINS"),
      sourceKeys.goalReward("a", "POINTS"),
      sourceKeys.chapterReward("a", "COINS"),
      sourceKeys.questReward("a", "COINS"),
    ]);
    expect(keys.size).toBe(5);
  });
});
