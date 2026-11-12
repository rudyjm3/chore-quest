import { describe, expect, it } from "vitest";

import { decodeHistoryCursor, encodeHistoryCursor } from "@/features/history/cursor";

const id = "0190a000-0000-7000-8000-000000000001";

describe("history cursor", () => {
  it("round-trips", () => {
    const encoded = encodeHistoryCursor({ localDate: "2026-11-10", id });
    expect(decodeHistoryCursor(encoded)).toEqual({ localDate: "2026-11-10", id });
  });
  it.each([
    null,
    "",
    "not-base64!!",
    Buffer.from("2026-13-40|" + id).toString("base64url"),
    Buffer.from("2026-11-10|nope").toString("base64url"),
    Buffer.from("2026-11-10|" + id + "|x").toString("base64url"),
    Buffer.from("2026-11-10").toString("base64url"),
    "a".repeat(500),
  ])("rejects malformed input %#", (value) => {
    expect(decodeHistoryCursor(value)).toBeNull();
  });
});
