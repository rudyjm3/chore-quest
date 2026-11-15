import { describe, expect, it } from "vitest";

import { buildSceneSlots, type SceneSlotItem } from "@/features/adventures/crew-camp";
import { getAsset, getCrewCampScene, getItemAsset } from "@/game/themes";
import { pirateItems } from "@/game/themes/pirate";

const item = (key: string, equipped: boolean): SceneSlotItem => ({
  key,
  name: key,
  type: "COSMETIC",
  iconKey: null,
  equipped,
});
const anchors = { head: { x: 50, y: 10, label: "Head" }, deck: { x: 50, y: 80, label: "Deck" } };

describe("buildSceneSlots", () => {
  it("shows the equipped item per anchored slot and null for empty spots", () => {
    const slots = buildSceneSlots(anchors, {
      head: [item("hat", false), item("crown", true)],
      deck: [item("cannon", false)],
    });
    expect(slots.map((s) => [s.slot, s.worn?.key ?? null])).toEqual([
      ["head", "crown"],
      ["deck", null],
    ]);
  });
  it("does not draw slots the theme has no anchor for", () => {
    const slots = buildSceneSlots(anchors, { flag: [item("flag", true)] });
    expect(slots.map((s) => s.slot)).toEqual(["head", "deck"]);
    expect(slots.every((s) => s.worn === null)).toBe(true);
  });
});

describe("pirate crew-camp scene data", () => {
  const scene = getCrewCampScene("pirate");
  it("has a ship asset in the manifest", () => {
    expect(scene).not.toBeNull();
    expect(getAsset("pirate", scene?.shipAssetId ?? "")).not.toBeNull();
  });
  it("anchors every slot a wearable item uses and has placeholder art for each item", () => {
    const wearable = pirateItems.filter(
      (i) => i.config && typeof i.config === "object" && "slot" in i.config,
    );
    expect(wearable.length).toBeGreaterThan(0);
    for (const i of wearable) {
      const slot = (i.config as { slot: string }).slot;
      expect(scene?.slots[slot], `anchor for slot ${slot}`).toBeDefined();
      expect(getItemAsset("pirate", i.iconKey), `art for ${i.key}`).not.toBeNull();
    }
  });
  it("returns null for an unknown theme", () => {
    expect(getCrewCampScene("nope")).toBeNull();
  });
});
