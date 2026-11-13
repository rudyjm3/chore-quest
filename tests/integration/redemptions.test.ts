import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  createRewardDefinition,
  getWallets,
  listLedger,
  parentAdjustment,
  requestRedemption,
  resolveRedemption,
  setRewardActive,
  updateRewardDefinition,
} from "@/server/services/reward.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture } from "../helpers/fixtures";

const db = testDb();

beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

async function setup(balance = 50, reward: { costPoints?: number; stock?: number } = {}) {
  const { family, ctx } = await createFamilyFixture(db);
  const kid = await createChildFixture(db, family.id);
  if (balance > 0) {
    await parentAdjustment(db, ctx, {
      familyId: family.id,
      childId: kid.child.id,
      currency: "POINTS",
      amount: balance,
      reason: "seed",
      idempotencyKey: `seed-${family.id}`,
    });
  }
  const definition = await createRewardDefinition(db, ctx, {
    familyId: family.id,
    title: "Movie night",
    costPoints: reward.costPoints ?? 30,
    stock: reward.stock,
  });
  return { family, ctx, kid, definition };
}

const points = async (childId: string) => (await getWallets(db, childId)).POINTS;

describe("reward catalogue", () => {
  it("creates, edits, archives and restores rewards with audit entries", async () => {
    const s = await setup();
    await updateRewardDefinition(db, s.ctx, {
      familyId: s.family.id,
      rewardId: s.definition.id,
      title: "Movie night!",
      costPoints: 40,
      stock: 3,
    });
    const archived = await setRewardActive(db, s.ctx, {
      familyId: s.family.id,
      rewardId: s.definition.id,
      active: false,
    });
    expect(archived.isActive).toBe(false);
    await expect(requestRedemption(db, s.kid.ctx, s.definition.id)).rejects.toThrow(/not found/i);
    await setRewardActive(db, s.ctx, {
      familyId: s.family.id,
      rewardId: s.definition.id,
      active: true,
    });
    const actions = (await db.auditLog.findMany({ where: { familyId: s.family.id } })).map(
      (a) => a.action,
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        "reward.create",
        "reward.update",
        "reward.archive",
        "reward.restore",
      ]),
    );
  });

  it("the database rejects negative stock", async () => {
    const s = await setup();
    await expect(
      db.rewardDefinition.update({ where: { id: s.definition.id }, data: { stock: -1 } }),
    ).rejects.toThrow(/stock_nonneg/);
  });

  it("another family cannot edit or archive the reward", async () => {
    const a = await setup();
    const b = await createFamilyFixture(db);
    await expect(
      updateRewardDefinition(db, b.ctx, {
        familyId: b.family.id,
        rewardId: a.definition.id,
        title: "x",
        costPoints: 1,
      }),
    ).rejects.toThrow(/not found/i);
  });
});

describe("requesting a redemption", () => {
  it("reserves points and stock immediately and notifies the parent", async () => {
    const s = await setup(50, { costPoints: 30, stock: 2 });
    const r = await requestRedemption(db, s.kid.ctx, s.definition.id);
    expect(r.status).toBe("REQUESTED");
    expect(await points(s.kid.child.id)).toBe(20);
    expect(
      (await db.rewardDefinition.findUniqueOrThrow({ where: { id: s.definition.id } })).stock,
    ).toBe(1);
    expect(r.ledgerEntryId).not.toBeNull();
    const note = await db.notification.findFirstOrThrow({
      where: { familyId: s.family.id, kind: "REDEMPTION_REQUESTED" },
    });
    expect(note.recipientUserId).toBe(s.ctx.userId);
  });

  it("refuses when the child cannot afford it or stock is gone", async () => {
    const poor = await setup(10);
    await expect(requestRedemption(db, poor.kid.ctx, poor.definition.id)).rejects.toThrow(
      /Not enough points/,
    );
    const empty = await setup(100, { stock: 0 });
    await expect(requestRedemption(db, empty.kid.ctx, empty.definition.id)).rejects.toThrow(
      /all gone/,
    );
  });

  it("two simultaneous requests against one balance: exactly one wins (repeated rounds)", async () => {
    for (let round = 0; round < 6; round += 1) {
      const s = await setup(30, { costPoints: 30 });
      const results = await Promise.allSettled([
        requestRedemption(db, s.kid.ctx, s.definition.id),
        requestRedemption(db, s.kid.ctx, s.definition.id),
        requestRedemption(db, s.kid.ctx, s.definition.id),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await points(s.kid.child.id)).toBe(0);
      expect(await db.rewardRedemption.count({ where: { childId: s.kid.child.id } })).toBe(1);
    }
  });

  it("two children racing for the last unit: exactly one gets it", async () => {
    for (let round = 0; round < 6; round += 1) {
      const s = await setup(100, { costPoints: 10, stock: 1 });
      const other = await createChildFixture(db, s.family.id, "Sib");
      await parentAdjustment(db, s.ctx, {
        familyId: s.family.id,
        childId: other.child.id,
        currency: "POINTS",
        amount: 100,
        reason: "seed",
        idempotencyKey: `seed-other-${round}-${s.family.id}`,
      });
      const results = await Promise.allSettled([
        requestRedemption(db, s.kid.ctx, s.definition.id),
        requestRedemption(db, other.ctx, s.definition.id),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(
        (await db.rewardDefinition.findUniqueOrThrow({ where: { id: s.definition.id } })).stock,
      ).toBe(0);
      // The loser's balance is untouched.
      const balances = [await points(s.kid.child.id), await points(other.child.id)].sort(
        (a, b) => a - b,
      );
      expect(balances).toEqual([90, 100]);
    }
  });

  it("a child cannot request another family's reward", async () => {
    const a = await setup();
    const b = await setup();
    await expect(requestRedemption(db, b.kid.ctx, a.definition.id)).rejects.toThrow(/not found/i);
  });
});

describe("resolving a redemption", () => {
  it("approve keeps the reservation; fulfill follows; the child is notified with the note", async () => {
    const s = await setup();
    const r = await requestRedemption(db, s.kid.ctx, s.definition.id);
    const approved = await resolveRedemption(db, s.ctx, {
      redemptionId: r.id,
      decision: "APPROVED",
      note: "Friday at 7",
    });
    expect(approved.status).toBe("APPROVED");
    expect(approved.resolutionNote).toBe("Friday at 7");
    expect(await points(s.kid.child.id)).toBe(20);
    const done = await resolveRedemption(db, s.ctx, { redemptionId: r.id, decision: "FULFILLED" });
    expect(done.status).toBe("FULFILLED");
    expect(done.resolutionNote).toBe("Friday at 7");
    const notes = await db.notification.findMany({
      where: { recipientChildId: s.kid.child.id },
      orderBy: { createdAt: "asc" },
    });
    expect(notes.map((n) => n.kind)).toEqual(["REDEMPTION_RESOLVED", "REDEMPTION_RESOLVED"]);
    expect(notes[0].body).toBe("Friday at 7");
  });

  it("deny refunds the points and restores the stock exactly once", async () => {
    const s = await setup(50, { costPoints: 30, stock: 1 });
    const r = await requestRedemption(db, s.kid.ctx, s.definition.id);
    const denied = await resolveRedemption(db, s.ctx, {
      redemptionId: r.id,
      decision: "DENIED",
      note: "Not this week",
    });
    expect(denied.status).toBe("DENIED");
    expect(denied.refundEntryId).not.toBeNull();
    expect(await points(s.kid.child.id)).toBe(50);
    expect(
      (await db.rewardDefinition.findUniqueOrThrow({ where: { id: s.definition.id } })).stock,
    ).toBe(1);
    // Repeating the same decision is a no-op; the opposite is rejected.
    await resolveRedemption(db, s.ctx, { redemptionId: r.id, decision: "DENIED" });
    await expect(
      resolveRedemption(db, s.ctx, { redemptionId: r.id, decision: "APPROVED" }),
    ).rejects.toThrow(/already resolved/);
    expect(await points(s.kid.child.id)).toBe(50);
    const ledger = await listLedger(db, s.kid.child.id, 10);
    expect(ledger.entries.filter((e) => e.sourceType === "REDEMPTION_REFUND")).toHaveLength(1);
  });

  it("double-resolve race: concurrent deny + deny and deny + approve never double-refund", async () => {
    for (let round = 0; round < 6; round += 1) {
      const s = await setup(50, { costPoints: 30, stock: 1 });
      const r = await requestRedemption(db, s.kid.ctx, s.definition.id);
      const results = await Promise.allSettled([
        resolveRedemption(db, s.ctx, { redemptionId: r.id, decision: "DENIED" }),
        resolveRedemption(db, s.ctx, { redemptionId: r.id, decision: "DENIED" }),
        resolveRedemption(db, s.ctx, { redemptionId: r.id, decision: "APPROVED" }),
      ]);
      const final = await db.rewardRedemption.findUniqueOrThrow({ where: { id: r.id } });
      const expectedBalance = final.status === "DENIED" ? 50 : 20;
      expect(await points(s.kid.child.id)).toBe(expectedBalance);
      expect(
        (await db.rewardDefinition.findUniqueOrThrow({ where: { id: s.definition.id } })).stock,
      ).toBe(final.status === "DENIED" ? 1 : 0);
      expect(
        await db.rewardLedgerEntry.count({
          where: { childId: s.kid.child.id, sourceType: "REDEMPTION_REFUND" },
        }),
      ).toBe(final.status === "DENIED" ? 1 : 0);
      expect(results.some((x) => x.status === "fulfilled")).toBe(true);
    }
  });

  it("fulfil before approve is rejected; another family cannot resolve", async () => {
    const s = await setup();
    const r = await requestRedemption(db, s.kid.ctx, s.definition.id);
    await expect(
      resolveRedemption(db, s.ctx, { redemptionId: r.id, decision: "FULFILLED" }),
    ).rejects.toThrow(/Approve the redemption first/);
    const other = await createFamilyFixture(db);
    await expect(
      resolveRedemption(db, other.ctx, { redemptionId: r.id, decision: "DENIED" }),
    ).rejects.toThrow(/not found/i);
  });

  it("the database refuses a refund entry without a debit entry", async () => {
    const s = await setup();
    const r = await requestRedemption(db, s.kid.ctx, s.definition.id);
    const entry = await db.rewardLedgerEntry.findFirstOrThrow({
      where: { childId: s.kid.child.id, sourceType: "REDEMPTION" },
    });
    await expect(
      db.rewardRedemption.update({
        where: { id: r.id },
        data: { ledgerEntryId: null, refundEntryId: entry.id },
      }),
    ).rejects.toThrow(/refund_needs_debit/);
  });
});

describe("requests created before reservation existed (legacy rows)", () => {
  async function legacy(balance: number) {
    const s = await setup(balance, { costPoints: 30 });
    const r = await db.rewardRedemption.create({
      data: {
        familyId: s.family.id,
        childId: s.kid.child.id,
        rewardDefinitionId: s.definition.id,
        costPoints: 30,
      },
    });
    return { ...s, r };
  }

  it("denying an unreserved request refunds nothing and leaves stock alone", async () => {
    const s = await legacy(50);
    const denied = await resolveRedemption(db, s.ctx, { redemptionId: s.r.id, decision: "DENIED" });
    expect(denied.status).toBe("DENIED");
    expect(denied.refundEntryId).toBeNull();
    expect(await points(s.kid.child.id)).toBe(50);
  });

  it("approving an unreserved request charges it then, once, or fails if unaffordable", async () => {
    const s = await legacy(50);
    const approved = await resolveRedemption(db, s.ctx, {
      redemptionId: s.r.id,
      decision: "APPROVED",
    });
    expect(approved.ledgerEntryId).not.toBeNull();
    expect(await points(s.kid.child.id)).toBe(20);
    await resolveRedemption(db, s.ctx, { redemptionId: s.r.id, decision: "APPROVED" });
    expect(await points(s.kid.child.id)).toBe(20);

    const poor = await legacy(10);
    await expect(
      resolveRedemption(db, poor.ctx, { redemptionId: poor.r.id, decision: "APPROVED" }),
    ).rejects.toThrow(/Insufficient/);
    expect((await db.rewardRedemption.findUniqueOrThrow({ where: { id: poor.r.id } })).status).toBe(
      "REQUESTED",
    );
  });
});
