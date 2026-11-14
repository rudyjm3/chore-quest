import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { parseAdventureState } from "@/game/schemas";
import { startAdventure } from "@/server/services/adventure.service";
import { equipCosmetic } from "@/server/services/crew-camp.service";
import { grantItem } from "@/server/services/inventory.service";
import { getLighthouseStatus, lookOutFromLighthouse } from "@/server/services/location.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture } from "../helpers/fixtures";

const db = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

// Fixture families use America/New_York (UTC-5 in November).
const NOON = new Date("2026-11-14T17:00:00Z"); // 12:00 local, Nov 14
const LATE_SAME_DAY = new Date("2026-11-15T04:30:00Z"); // 23:30 local, still Nov 14
const NEXT_DAY = new Date("2026-11-15T05:30:00Z"); // 00:30 local, Nov 15

async function setup() {
  const { family } = await createFamilyFixture(db);
  const a = await createChildFixture(db, family.id, "Ada");
  const b = await createChildFixture(db, family.id, "Bo");
  for (const c of [a, b]) {
    await startAdventure(db, { familyId: family.id, childId: c.child.id, adventureKey: "pirate" });
  }
  return { family, a, b };
}
const look = (ctx: Awaited<ReturnType<typeof setup>>["a"]["ctx"], now: Date) =>
  lookOutFromLighthouse(db, ctx, { adventureKey: "pirate", now });
const status = (ctx: Awaited<ReturnType<typeof setup>>["a"]["ctx"], now: Date) =>
  getLighthouseStatus(db, ctx, { adventureKey: "pirate", now });
const stateOf = async (childId: string) =>
  (await db.childAdventureProgress.findFirstOrThrow({ where: { childId } })).state;

describe("lighthouse: one look per household-local day (ADR 0017)", () => {
  it("the first look counts, the second the same local day does not, the next local day does", async () => {
    const { a } = await setup();
    expect(await status(a.ctx, NOON)).toEqual({ started: true, lookedToday: false });
    expect(await look(a.ctx, NOON)).toEqual({ newlyLooked: true, lookedOn: "2026-11-14" });
    expect(await status(a.ctx, NOON)).toEqual({ started: true, lookedToday: true });
    expect((await look(a.ctx, LATE_SAME_DAY)).newlyLooked).toBe(false);
    expect(await status(a.ctx, NEXT_DAY)).toEqual({ started: true, lookedToday: false });
    expect(await look(a.ctx, NEXT_DAY)).toEqual({ newlyLooked: true, lookedOn: "2026-11-15" });
  });

  it("a sibling's look never counts for this child", async () => {
    const { a, b } = await setup();
    await look(a.ctx, NOON);
    expect((await status(b.ctx, NOON)).lookedToday).toBe(false);
    expect((await look(b.ctx, NOON)).newlyLooked).toBe(true);
  });

  it("refuses before the adventure is started and reports not started", async () => {
    const { family } = await createFamilyFixture(db);
    const { ctx } = await createChildFixture(db, family.id, "Newbie");
    expect(await status(ctx, NOON)).toEqual({ started: false, lookedToday: false });
    await expect(look(ctx, NOON)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("keeps the equipped cosmetics and unknown state keys", async () => {
    const { family, a } = await setup();
    await db.$transaction((tx) =>
      grantItem(tx, {
        familyId: family.id,
        childId: a.child.id,
        itemKey: "cosmetic-captain-hat",
        quantity: 1,
        sourceType: "PURCHASE",
        sourceKey: `test-grant:${a.child.id}:hat`,
      }),
    );
    await equipCosmetic(db, a.ctx, {
      adventureKey: "pirate",
      slot: "head",
      itemKey: "cosmetic-captain-hat",
    });
    await db.childAdventureProgress.updateMany({
      where: { childId: a.child.id },
      data: { state: { ...((await stateOf(a.child.id)) as object), futureFlag: 7 } },
    });
    await look(a.ctx, NOON);
    const state = parseAdventureState(await stateOf(a.child.id));
    expect(state.equipped).toEqual({ head: "cosmetic-captain-hat" });
    expect(state.futureFlag).toBe(7);
    expect(state.lighthouse).toEqual({ lastLookDate: "2026-11-14" });
  });

  it("a corrupt lighthouse value is ignored without resetting the equipped map", async () => {
    const { a } = await setup();
    await db.childAdventureProgress.updateMany({
      where: { childId: a.child.id },
      data: {
        state: { equipped: { head: "cosmetic-captain-hat" }, lighthouse: { lastLookDate: 5 } },
      },
    });
    expect(parseAdventureState(await stateOf(a.child.id)).equipped).toEqual({
      head: "cosmetic-captain-hat",
    });
    expect((await status(a.ctx, NOON)).lookedToday).toBe(false);
    expect((await look(a.ctx, NOON)).newlyLooked).toBe(true);
  });

  it("racing looks the same day: exactly one is new (looped)", async () => {
    const { a } = await setup();
    for (let round = 0; round < 8; round += 1) {
      await db.childAdventureProgress.updateMany({
        where: { childId: a.child.id },
        data: { state: { equipped: {} } },
      });
      const results = await Promise.all(Array.from({ length: 5 }, () => look(a.ctx, NOON)));
      expect(results.filter((r) => r.newlyLooked)).toHaveLength(1);
    }
  });

  it("a look racing an equip loses neither write (looped)", async () => {
    const { family, a } = await setup();
    await db.$transaction((tx) =>
      grantItem(tx, {
        familyId: family.id,
        childId: a.child.id,
        itemKey: "cosmetic-captain-hat",
        quantity: 1,
        sourceType: "PURCHASE",
        sourceKey: `test-grant:${a.child.id}:hat2`,
      }),
    );
    for (let round = 0; round < 15; round += 1) {
      await db.childAdventureProgress.updateMany({
        where: { childId: a.child.id },
        data: { state: { equipped: {} } },
      });
      await Promise.all([
        look(a.ctx, NOON),
        equipCosmetic(db, a.ctx, {
          adventureKey: "pirate",
          slot: "head",
          itemKey: "cosmetic-captain-hat",
        }),
      ]);
      const state = parseAdventureState(await stateOf(a.child.id));
      expect(state.equipped).toEqual({ head: "cosmetic-captain-hat" });
      expect(state.lighthouse).toEqual({ lastLookDate: "2026-11-14" });
    }
  });
});
