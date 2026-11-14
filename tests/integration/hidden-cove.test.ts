import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { lockChildRow } from "@/lib/db/prisma";
import { startAdventure } from "@/server/services/adventure.service";
import { grantItem, inventoryByItemKey } from "@/server/services/inventory.service";
import { getLocationStatus, visitLocation } from "@/server/services/location.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture } from "../helpers/fixtures";

const db = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

const COVE = { adventureKey: "pirate", chapterKey: "home-port", locationKey: "hidden-cove" };

async function setup(withFragment: boolean, name = "Kid") {
  const { family } = await createFamilyFixture(db);
  const { child, ctx } = await createChildFixture(db, family.id, name);
  await startAdventure(db, { familyId: family.id, childId: child.id, adventureKey: "pirate" });
  if (withFragment) await giveFragment(family.id, child.id);
  return { family, child, ctx };
}
async function giveFragment(familyId: string, childId: string) {
  await db.$transaction((tx) =>
    grantItem(tx, {
      familyId,
      childId,
      itemKey: "map-fragment",
      quantity: 1,
      sourceType: "PARENT_GRANT",
      sourceKey: `test:${childId}:fragment`,
    }),
  );
}
const pearlGrants = (childId: string) =>
  db.inventoryGrant.count({ where: { childId, sourceType: "LOCATION_REWARD" } });

describe("hidden cove", () => {
  it("is locked without the required item and refuses a hand-crafted visit", async () => {
    const s = await setup(false);
    expect(await getLocationStatus(db, s.ctx, COVE)).toMatchObject({
      status: "locked",
      requiresItemKey: "map-fragment",
    });
    await expect(visitLocation(db, s.ctx, COVE)).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(await pearlGrants(s.child.id)).toBe(0);
    expect((await inventoryByItemKey(db, s.child.id))["cove-pearl"]).toBeUndefined();
  });

  it("grants the pearl once, then reports it found", async () => {
    const s = await setup(true);
    expect((await getLocationStatus(db, s.ctx, COVE)).status).toBe("available");
    const first = await visitLocation(db, s.ctx, COVE);
    expect(first).toEqual({ granted: true, itemKey: "cove-pearl" });
    const again = await visitLocation(db, s.ctx, COVE);
    expect(again.granted).toBe(false);
    expect((await getLocationStatus(db, s.ctx, COVE)).status).toBe("found");
    expect(await pearlGrants(s.child.id)).toBe(1);
    expect((await inventoryByItemKey(db, s.child.id))["cove-pearl"]).toBe(1);
  });

  it("stays found if the requirement item is later gone (no re-grant, no error)", async () => {
    const s = await setup(true);
    await visitLocation(db, s.ctx, COVE);
    await db.childInventoryItem.updateMany({
      where: { childId: s.child.id, item: { key: "map-fragment" } },
      data: { quantity: 0 },
    });
    expect((await visitLocation(db, s.ctx, COVE)).granted).toBe(false);
    expect(await pearlGrants(s.child.id)).toBe(1);
  });

  it("is per child: a sibling's find does not unlock or hide it", async () => {
    const a = await setup(true, "A");
    const { child: b, ctx: bCtx } = await createChildFixture(db, a.family.id, "B");
    await startAdventure(db, { familyId: a.family.id, childId: b.id, adventureKey: "pirate" });
    await visitLocation(db, a.ctx, COVE);
    // B has no fragment: still locked, and A's grant is not B's.
    expect((await getLocationStatus(db, bCtx, COVE)).status).toBe("locked");
    await giveFragment(a.family.id, b.id);
    expect((await getLocationStatus(db, bCtx, COVE)).status).toBe("available");
    expect((await visitLocation(db, bCtx, COVE)).granted).toBe(true);
    expect(await pearlGrants(a.child.id)).toBe(1);
    expect(await pearlGrants(b.id)).toBe(1);
  });

  it("unknown places and chapters are not found; not-started children are told so", async () => {
    const s = await setup(true);
    await expect(
      visitLocation(db, s.ctx, { ...COVE, locationKey: "lighthouse" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" }); // exists, but has no reward
    await expect(
      visitLocation(db, s.ctx, { ...COVE, chapterKey: "skull-reef" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" }); // chapter still locked
    const { family } = await createFamilyFixture(db);
    const { ctx } = await createChildFixture(db, family.id, "New");
    expect((await getLocationStatus(db, ctx, COVE)).status).toBe("not-started");
    await expect(visitLocation(db, ctx, COVE)).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});

describe("hidden cove concurrency", () => {
  it("racing visits grant exactly once and none of them errors", async () => {
    for (let round = 0; round < 8; round += 1) {
      await resetHouseholdData(db);
      const s = await setup(true);
      const results = await Promise.all(
        Array.from({ length: 5 }, () => visitLocation(db, s.ctx, COVE)),
      );
      expect(results.filter((r) => r.granted)).toHaveLength(1);
      expect(await pearlGrants(s.child.id)).toBe(1);
    }
  });

  it("waits for the child row lock (deterministic)", async () => {
    const s = await setup(true);
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
    const pending = visitLocation(db, s.ctx, COVE).then(() => (done = true));
    await new Promise((r) => setTimeout(r, 400));
    expect(done).toBe(false);
    release();
    await holder;
    await pending;
    expect(await pearlGrants(s.child.id)).toBe(1);
  });
});
