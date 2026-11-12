import { describe, expect, it } from "vitest";

import { checkCompletionWindow, windowOf } from "@/features/routines/window";

const NY = "America/New_York";
const w = { start: "06:00", end: "09:00" };
// 2026-11-10 is EST (UTC-5): 06:00 local = 11:00Z
const at = (iso: string) => new Date(iso);

describe("completion window", () => {
  it("no window is always open", () => {
    expect(
      checkCompletionWindow({
        now: at("2026-11-10T03:00:00Z"),
        localDate: "2026-11-10",
        window: null,
        timeZone: NY,
      }).open,
    ).toBe(true);
    expect(windowOf("06:00", null)).toBeNull();
  });
  it("is inclusive at both bounds and closed outside", () => {
    const check = (iso: string) =>
      checkCompletionWindow({ now: at(iso), localDate: "2026-11-10", window: w, timeZone: NY });
    expect(check("2026-11-10T10:59:00Z")).toMatchObject({ open: false, reason: "too-early" });
    expect(check("2026-11-10T11:00:00Z").open).toBe(true);
    expect(check("2026-11-10T14:00:00Z").open).toBe(true);
    expect(check("2026-11-10T14:01:00Z")).toMatchObject({ open: false, reason: "too-late" });
  });
  it("uses household time, not UTC (same instant, different zone)", () => {
    const now = at("2026-11-10T11:30:00Z"); // 06:30 NY, 20:30 Auckland(+13)
    expect(
      checkCompletionWindow({ now, localDate: "2026-11-10", window: w, timeZone: NY }).open,
    ).toBe(true);
    expect(
      checkCompletionWindow({
        now,
        localDate: "2026-11-10",
        window: w,
        timeZone: "Pacific/Auckland",
      }).open,
    ).toBe(false);
  });
  it("supports overnight windows ending the next local day", () => {
    const night = { start: "20:00", end: "06:00" };
    const check = (iso: string) =>
      checkCompletionWindow({ now: at(iso), localDate: "2026-11-10", window: night, timeZone: NY });
    expect(check("2026-11-11T02:00:00Z").open).toBe(true); // 21:00 NY on the 10th
    expect(check("2026-11-11T10:00:00Z").open).toBe(true); // 05:00 NY on the 11th
    expect(check("2026-11-11T12:00:00Z")).toMatchObject({ open: false, reason: "too-late" });
  });
  it("follows DST: 06:00 local is 10:00Z in summer", () => {
    const check = (iso: string) =>
      checkCompletionWindow({ now: at(iso), localDate: "2026-07-10", window: w, timeZone: NY });
    expect(check("2026-07-10T09:59:00Z").open).toBe(false);
    expect(check("2026-07-10T10:00:00Z").open).toBe(true);
  });
});
