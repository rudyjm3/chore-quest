import { describe, expect, it } from "vitest";

import { isValidActionPrefix, summarizeAudit } from "@/features/audit/summary";

describe("summarizeAudit", () => {
  it("renders known actions from safe fields", () => {
    expect(
      summarizeAudit("reward.adjust", { amount: -5, currency: "POINTS", reason: "Lost toy" }),
    ).toBe("Adjusted points by -5 — Lost toy");
    expect(
      summarizeAudit("goal.update", { title: "Reading", previousTargetCount: 3, targetCount: 5 }),
    ).toBe("Edited goal “Reading” (target 3 → 5)");
    expect(summarizeAudit("approval.reject", { note: "Redo" })).toBe(
      "Sent a chore back to try again — note: Redo",
    );
  });

  it("never prints raw JSON or unexpected fields", () => {
    const text = summarizeAudit("reward.create", {
      title: "Pizza",
      token: "abc",
      nested: { a: 1 },
    });
    expect(text).toBe("Added reward “Pizza”");
    expect(text).not.toContain("abc");
    expect(text).not.toContain("{");
  });

  it("tolerates missing, null and wrongly typed metadata", () => {
    expect(summarizeAudit("reward.create", null)).toBe("Added reward");
    expect(summarizeAudit("reward.create", { title: 42, costPoints: "5" })).toBe("Added reward");
  });

  it("humanises unknown actions", () => {
    expect(summarizeAudit("future.thing_happened", { x: 1 })).toBe("Future thing happened");
  });

  it("validates prefixes", () => {
    expect(isValidActionPrefix("reward")).toBe(true);
    expect(isValidActionPrefix("goal.assignment")).toBe(true);
    expect(isValidActionPrefix("a%")).toBe(false);
    expect(isValidActionPrefix("")).toBe(false);
  });
});
