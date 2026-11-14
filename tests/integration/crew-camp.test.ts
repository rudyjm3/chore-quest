import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { startAdventure } from "@/server/services/adventure.service";
import { equipCosmetic, getCrewCamp } from "@/server/services/crew-camp.service";
import { grantItem } from "@/server/services/inventory.service";
import { lockChildRow } from "@/lib/db/prisma";
import { parseAdventureState } from "@/game/schemas";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture } from "../helpers/fixtures";

const db = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

async function setup(owned: string[] = []) {
  const { family } = await createFamilyFixture(db);
  const { child, ctx } = await createChildFixture(db, family.id);
  await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
  await give(family.id, child.id, owned);
  return { family, child, ctx };
}
async function give(familyId: string, childId: string, itemKeys: string[]) {
  await db.$transaction(async (tx) => {
    for (const itemKey of itemKeys) {
      await grantItem(tx, {
        familyId,
        childId,
        itemKey,
        quantity: 1,
        sourceType: "PURCHASE",
        sourceKey: `test-grant:${childId}:${itemKey}`,
      });
    }
  });
}
const equip = (
  ctx: Awaited<ReturnType<typeof setup>>["ctx"],
  slot: string,
  itemKey: string | null,
) => equipCosmetic(db, ctx, { adventureKey: "pirate", slot, itemKey });
async function stored(childId: string) {
  const row = await db.childAdventureProgress.findFirstOrThrow({ where: { childId } });
  return parseAdventureState(row.state).equipped;
}

describe("equipCosmetic", () => {
  it("equips an owned item in its slot and persists it", async () => {
    const s = await setup(["cosmetic-captain-hat"]);
    await equip(s.ctx, "head", "cosmetic-captain-hat");
    expect(await stored(s.child.id)).toEqual({ head: "cosmetic-captain-hat" });
    const camp = await getCrewCamp(db, s.ctx, "pirate");
    expect(camp.slots.head?.[0]).toMatchObject({ key: "cosmetic-captain-hat", equipped: true });
  });

  it("unequips with null and is idempotent", async () => {
    const s = await setup(["cosmetic-captain-hat"]);
    await equip(s.ctx, "head", "cosmetic-captain-hat");
    await equip(s.ctx, "head", null);
    await equip(s.ctx, "head", null);
    expect(await stored(s.child.id)).toEqual({});
  });

  it("refuses an item the child does not own", async () => {
    const s = await setup();
    await expect(equip(s.ctx, "head", "cosmetic-captain-hat")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await stored(s.child.id)).toEqual({});
  });

  it("refuses the wrong slot and non-wearable items", async () => {
    const s = await setup(["cosmetic-captain-hat", "supply-crate"]);
    await expect(equip(s.ctx, "sail", "cosmetic-captain-hat")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(equip(s.ctx, "deck", "supply-crate")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await expect(equip(s.ctx, "head", "no-such-item")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("refuses before the adventure is started", async () => {
    const { family } = await createFamilyFixture(db);
    const { ctx } = await createChildFixture(db, family.id);
    await expect(equip(ctx, "head", null)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("never uses another child's item, even in the same family", async () => {
    const a = await setup(["cosmetic-captain-hat"]);
    const { child: other, ctx: otherCtx } = await createChildFixture(db, a.family.id, "Sib");
    await startAdventure(db, {
      familyId: a.family.id,
      childId: other.id,
      adventureKey: "pirate",
    });
    await expect(equip(otherCtx, "head", "cosmetic-captain-hat")).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    expect(await stored(other.id)).toEqual({});
    // And the sibling's camp lists nothing of the first child's.
    const camp = await getCrewCamp(db, otherCtx, "pirate");
    expect(camp.slots).toEqual({});
  });

  it("does not trust a context from another family", async () => {
    const a = await setup(["cosmetic-captain-hat"]);
    const b = await createFamilyFixture(db);
    const wrong = { ...a.ctx, familyId: b.family.id };
    await expect(equip(wrong, "head", "cosmetic-captain-hat")).rejects.toBeDefined();
    expect(await stored(a.child.id)).toEqual({});
  });

  it("an equipped item that is no longer owned is not shown as worn", async () => {
    const s = await setup(["cosmetic-captain-hat"]);
    await equip(s.ctx, "head", "cosmetic-captain-hat");
    await db.childInventoryItem.updateMany({
      where: { childId: s.child.id },
      data: { quantity: 0 },
    });
    const camp = await getCrewCamp(db, s.ctx, "pirate");
    expect(camp.slots).toEqual({});
  });

  it("keeps other state keys when equipping", async () => {
    const s = await setup(["cosmetic-captain-hat"]);
    await db.childAdventureProgress.updateMany({
      where: { childId: s.child.id },
      data: { state: { equipped: {}, flag: "keep" } },
    });
    await equip(s.ctx, "head", "cosmetic-captain-hat");
    const row = await db.childAdventureProgress.findFirstOrThrow({
      where: { childId: s.child.id },
    });
    expect((row.state as Record<string, unknown>).flag).toBe("keep");
  });
});

describe("equipCosmetic concurrency", () => {
  it("racing equips of different slots all survive (no lost update)", async () => {
    const s = await setup(["cosmetic-captain-hat", "upgrade-patched-sail", "upgrade-parrot-perch"]);
    for (let round = 0; round < 15; round++) {
      await equip(s.ctx, "head", null);
      await equip(s.ctx, "sail", null);
      await equip(s.ctx, "deck", null);
      await Promise.all([
        equip(s.ctx, "head", "cosmetic-captain-hat"),
        equip(s.ctx, "sail", "upgrade-patched-sail"),
        equip(s.ctx, "deck", "upgrade-parrot-perch"),
      ]);
      expect(await stored(s.child.id)).toEqual({
        head: "cosmetic-captain-hat",
        sail: "upgrade-patched-sail",
        deck: "upgrade-parrot-perch",
      });
    }
  });

  it("racing equips of the same slot end with exactly one winner", async () => {
    const s = await setup(["upgrade-parrot-perch", "upgrade-brass-cannon"]);
    for (let round = 0; round < 10; round++) {
      await Promise.all([
        equip(s.ctx, "deck", "upgrade-parrot-perch"),
        equip(s.ctx, "deck", "upgrade-brass-cannon"),
        equip(s.ctx, "deck", null),
      ]);
      const equipped = await stored(s.child.id);
      expect(Object.keys(equipped).every((k) => k === "deck")).toBe(true);
    }
  });

  it("waits for the child row lock (deterministic)", async () => {
    const s = await setup(["cosmetic-captain-hat"]);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let locked!: () => void;
    const lockTaken = new Promise<void>((r) => (locked = r));
    const holder = db.$transaction(async (tx) => {
      await lockChildRow(tx, s.child.id);
      locked();
      await gate;
    });
    await lockTaken;
    let done = false;
    const pending = equip(s.ctx, "head", "cosmetic-captain-hat").then(() => (done = true));
    await new Promise((r) => setTimeout(r, 400));
    expect(done).toBe(false);
    release();
    await holder;
    await pending;
    expect(await stored(s.child.id)).toEqual({ head: "cosmetic-captain-hat" });
  });
});
