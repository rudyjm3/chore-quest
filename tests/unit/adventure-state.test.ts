import { describe, expect, it } from "vitest";

import { parseAdventureState } from "@/game/schemas";
import { itemSlot, slotLabel } from "@/features/adventures/crew-camp";

describe("parseAdventureState", () => {
  it("defaults an empty object and null", () => {
    expect(parseAdventureState({})).toEqual({ equipped: {} });
    expect(parseAdventureState(null)).toEqual({ equipped: {} });
  });
  it("keeps valid equipped slots and unknown keys", () => {
    const state = parseAdventureState({ equipped: { head: "cosmetic-captain-hat" }, flag: 1 });
    expect(state.equipped).toEqual({ head: "cosmetic-captain-hat" });
    expect(state.flag).toBe(1);
  });
  it("reads the lighthouse day and drops a malformed one without touching equipped", () => {
    expect(parseAdventureState({ lighthouse: { lastLookDate: "2026-11-14" } }).lighthouse).toEqual({
      lastLookDate: "2026-11-14",
    });
    for (const bad of [{ lastLookDate: 5 }, { lastLookDate: "yesterday" }, "x", null]) {
      const state = parseAdventureState({ equipped: { head: "hat" }, lighthouse: bad });
      expect(state.equipped).toEqual({ head: "hat" });
      expect(state.lighthouse).toBeUndefined();
    }
  });
  it("falls back to empty for malformed stored JSON", () => {
    expect(parseAdventureState({ equipped: { head: 5 } })).toEqual({ equipped: {} });
    expect(parseAdventureState({ equipped: { "BAD SLOT": "x" } })).toEqual({ equipped: {} });
    expect(parseAdventureState("nope")).toEqual({ equipped: {} });
  });
});

describe("itemSlot", () => {
  it("reads config.slot only when it is a non-empty string", () => {
    expect(itemSlot({ slot: "head" })).toBe("head");
    expect(itemSlot({ slot: "" })).toBeNull();
    expect(itemSlot({ slot: 3 })).toBeNull();
    expect(itemSlot({})).toBeNull();
    expect(itemSlot(null)).toBeNull();
  });
});

describe("slotLabel", () => {
  it("capitalises and spaces", () => {
    expect(slotLabel("head")).toBe("Head");
    expect(slotLabel("main-hand")).toBe("Main hand");
  });
});
