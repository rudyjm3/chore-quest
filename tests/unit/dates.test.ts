import { describe, expect, it } from "vitest";

import {
  addDays,
  dbToLocalDate,
  diffDays,
  endOfLocalDay,
  formatLocalDateTime,
  isLocalDate,
  localDateTimeToInstant,
  localDateToDb,
  startOfLocalDay,
  startOfWeek,
  timeZoneOffsetMinutes,
  toLocalDate,
  weekKey,
} from "@/lib/utils/dates";

describe("local dates", () => {
  it("validates calendar dates strictly", () => {
    expect(isLocalDate("2026-02-28")).toBe(true);
    expect(isLocalDate("2026-02-30")).toBe(false);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("26-01-01")).toBe(false);
  });

  it("maps an instant to the household-local date across the date line", () => {
    const instant = new Date("2026-11-10T03:30:00Z");
    expect(toLocalDate(instant, "UTC")).toBe("2026-11-10");
    expect(toLocalDate(instant, "America/Los_Angeles")).toBe("2026-11-09");
    expect(toLocalDate(instant, "Pacific/Auckland")).toBe("2026-11-10");
  });

  it("round-trips @db.Date values", () => {
    expect(dbToLocalDate(localDateToDb("2026-03-08"))).toBe("2026-03-08");
  });

  it("adds and diffs days across month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-01-01", "2026-12-31")).toBe(364);
  });

  it("computes week starts for Monday and Sunday weeks", () => {
    // 2026-11-10 is a Tuesday.
    expect(startOfWeek("2026-11-10", 1)).toBe("2026-11-09");
    expect(startOfWeek("2026-11-10", 0)).toBe("2026-11-08");
    expect(weekKey("2026-11-10", 1)).toBe("week:2026-11-09");
    expect(weekKey("2026-11-15", 1)).toBe("week:2026-11-09"); // Sunday still same Mon-week
    expect(weekKey("2026-11-16", 1)).toBe("week:2026-11-16");
  });
});

describe("daylight saving time", () => {
  it("knows the offset on either side of the US spring-forward transition", () => {
    expect(timeZoneOffsetMinutes(new Date("2026-03-08T06:00:00Z"), "America/New_York")).toBe(-300); // EST
    expect(timeZoneOffsetMinutes(new Date("2026-03-08T08:00:00Z"), "America/New_York")).toBe(-240); // EDT
  });

  it("start of the DST-transition day is 05:00Z (EST) and the next day starts 23 hours later", () => {
    const start = startOfLocalDay("2026-03-08", "America/New_York");
    const end = endOfLocalDay("2026-03-08", "America/New_York");
    expect(start.toISOString()).toBe("2026-03-08T05:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });

  it("the fall-back day is 25 hours long", () => {
    const start = startOfLocalDay("2026-11-01", "America/New_York");
    const end = endOfLocalDay("2026-11-01", "America/New_York");
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(25);
  });

  it("resolves a non-existent local time (02:30 on spring-forward) to a real instant", () => {
    const instant = localDateTimeToInstant("2026-03-08", "02:30", "America/New_York");
    // 02:30 does not exist; it resolves to 03:30 EDT = 07:30Z.
    expect(instant.toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("a due time maps to the correct instant in a non-DST zone", () => {
    expect(localDateTimeToInstant("2026-06-01", "18:00", "Asia/Tokyo").toISOString()).toBe(
      "2026-06-01T09:00:00.000Z",
    );
  });
});

describe("formatLocalDateTime", () => {
  it("formats in the household zone, not the server zone", () => {
    const instant = new Date("2026-11-10T15:30:00Z");
    expect(formatLocalDateTime(instant, "America/New_York")).toBe("2026-11-10 10:30 EST");
    expect(formatLocalDateTime(instant, "Asia/Tokyo")).toBe("2026-11-11 00:30 GMT+9");
    expect(formatLocalDateTime(instant, "UTC")).toBe("2026-11-10 15:30 UTC");
  });

  it("crosses the local date line and half-hour zones", () => {
    expect(formatLocalDateTime(new Date("2026-11-10T03:00:00Z"), "America/Los_Angeles")).toBe(
      "2026-11-09 19:00 PST",
    );
    expect(formatLocalDateTime(new Date("2026-11-10T00:00:00Z"), "Asia/Kolkata")).toBe(
      "2026-11-10 05:30 GMT+5:30",
    );
  });

  it("follows a DST change (US fall back 2026-11-01 and spring forward 2026-03-08)", () => {
    // 05:30Z = 01:30 EDT; 06:30Z = 01:30 EST (the repeated hour), distinguished by the zone name.
    expect(formatLocalDateTime(new Date("2026-11-01T05:30:00Z"), "America/New_York")).toBe(
      "2026-11-01 01:30 EDT",
    );
    expect(formatLocalDateTime(new Date("2026-11-01T06:30:00Z"), "America/New_York")).toBe(
      "2026-11-01 01:30 EST",
    );
    expect(formatLocalDateTime(new Date("2026-03-08T06:59:00Z"), "America/New_York")).toBe(
      "2026-03-08 01:59 EST",
    );
    expect(formatLocalDateTime(new Date("2026-03-08T07:00:00Z"), "America/New_York")).toBe(
      "2026-03-08 03:00 EDT",
    );
  });
});
