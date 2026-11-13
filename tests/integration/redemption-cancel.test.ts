import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  cancelRedemption,
  createRewardDefinition,
  getWallets,
  parentAdjustment,
  requestRedemption,
  resolveRedemption,
} from "@/server/services/reward.service";

import { disconnectTestDb, resetHouseholdData, testDb } from "../helpers/db";
import { createChildFixture, createFamilyFixture } from "../helpers/fixtures";

const db = testDb();
beforeEach(() => resetHouseholdData(db));
afterAll(() => disconnectTestDb());

async function setup(stock?: number) {
  const { family, ctx } = await createFamilyFixture(db);
  const kid = await createChildFixture(db, family.id);
  await parentAdjustment(db, ctx, {
    familyId: family.id,
    childId: kid.child.id,
    currency: "POINTS",
    amount: 50,
    reason: "seed",
    idempotencyKey: `seed-${family.id}`,
  });
  const reward = await createRewardDefinition(db, ctx, {
    familyId: family.id,
    title: "Movie night",
    costPoints: 30,
    stock,
  });
  return { family, ctx, kid, reward };
}
const points = async (childId: string) => (await getWallets(db, childId)).POINTS;
const stockOf = async (id: string) =>
  (await db.rewardDefinition.findUniqueOrThrow({ where: { id } })).stock;

describe("child cancels their own request", () => {
  it("refunds once, restores stock, notifies parents and audits", async () => {
    const s = await setup(2);
    const req = await requestRedemption(db, s.kid.ctx, s.reward.id);
    expect(await points(s.kid.child.id)).toBe(20);
    expect(await stockOf(s.reward.id)).toBe(1);

    const cancelled = await cancelRedemption(db, s.kid.ctx, req.id);
    expect(cancelled.status).toBe("CANCELLED");
    expect(cancelled.refundEntryId).not.toBeNull();
    expect(await points(s.kid.child.id)).toBe(50);
    expect(await stockOf(s.reward.id)).toBe(2);

    expect(
      await db.notification.count({
        where: { familyId: s.family.id, dedupeKey: `redemption:${req.id}:cancelled` },
      }),
    ).toBeGreaterThan(0);
    const audit = await db.auditLog.findFirst({
      where: { familyId: s.family.id, action: "reward.redemption.cancel" },
    });
    expect(audit?.actorType).toBe("CHILD");
  });

  it("double cancel is a no-op (one refund)", async () => {
    const s = await setup(2);
    const req = await requestRedemption(db, s.kid.ctx, s.reward.id);
    await cancelRedemption(db, s.kid.ctx, req.id);
    const again = await cancelRedemption(db, s.kid.ctx, req.id);
    expect(again.status).toBe("CANCELLED");
    expect(await points(s.kid.child.id)).toBe(50);
    expect(await stockOf(s.reward.id)).toBe(2);
    expect(await db.rewardLedgerEntry.count({ where: { sourceType: "REDEMPTION_REFUND" } })).toBe(
      1,
    );
  });

  it("concurrent double cancel refunds exactly once (looped)", async () => {
    for (let round = 0; round < 5; round++) {
      await resetHouseholdData(db);
      const s = await setup(3);
      const req = await requestRedemption(db, s.kid.ctx, s.reward.id);
      await Promise.all([
        cancelRedemption(db, s.kid.ctx, req.id),
        cancelRedemption(db, s.kid.ctx, req.id),
      ]);
      expect(await points(s.kid.child.id)).toBe(50);
      expect(await stockOf(s.reward.id)).toBe(3);
    }
  });

  it("cancel versus parent approve: exactly one wins and the books balance (looped)", async () => {
    for (let round = 0; round < 8; round++) {
      await resetHouseholdData(db);
      const s = await setup(3);
      const req = await requestRedemption(db, s.kid.ctx, s.reward.id);
      const [cancel, approve] = await Promise.allSettled([
        cancelRedemption(db, s.kid.ctx, req.id),
        resolveRedemption(db, s.ctx, { redemptionId: req.id, decision: "APPROVED" }),
      ]);
      const final = await db.rewardRedemption.findUniqueOrThrow({ where: { id: req.id } });
      if (final.status === "CANCELLED") {
        expect(cancel.status).toBe("fulfilled");
        expect(approve.status).toBe("rejected");
        expect(await points(s.kid.child.id)).toBe(50);
        expect(await stockOf(s.reward.id)).toBe(3);
      } else {
        expect(final.status).toBe("APPROVED");
        expect(cancel.status).toBe("rejected");
        expect(approve.status).toBe("fulfilled");
        expect(await points(s.kid.child.id)).toBe(20);
        expect(await stockOf(s.reward.id)).toBe(2);
      }
    }
  });

  it("deterministic: a cancel waiting on the child lock sees an approval made first", async () => {
    const s = await setup();
    const req = await requestRedemption(db, s.kid.ctx, s.reward.id);
    let cancel: Promise<unknown> = Promise.resolve();
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "child" WHERE id = ${s.kid.child.id}::uuid FOR UPDATE`;
      cancel = cancelRedemption(db, s.kid.ctx, req.id).catch((e: unknown) => e);
      await new Promise((r) => setTimeout(r, 300));
      await tx.rewardRedemption.update({ where: { id: req.id }, data: { status: "APPROVED" } });
    });
    expect(await cancel).toMatchObject({ code: "INVALID_STATE" });
    expect(await points(s.kid.child.id)).toBe(20);
  });

  it("another child's request is NOT_FOUND, and so is another family's", async () => {
    const s = await setup();
    const sibling = await createChildFixture(db, s.family.id);
    const req = await requestRedemption(db, s.kid.ctx, s.reward.id);
    await expect(cancelRedemption(db, sibling.ctx, req.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const other = await createFamilyFixture(db);
    const stranger = await createChildFixture(db, other.family.id);
    await expect(cancelRedemption(db, stranger.ctx, req.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await db.rewardRedemption.findUniqueOrThrow({ where: { id: req.id } })).status).toBe(
      "REQUESTED",
    );
  });

  it("cannot cancel after approval, denial or fulfilment", async () => {
    const s = await setup();
    const a = await requestRedemption(db, s.kid.ctx, s.reward.id);
    await resolveRedemption(db, s.ctx, { redemptionId: a.id, decision: "APPROVED" });
    await expect(cancelRedemption(db, s.kid.ctx, a.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await resolveRedemption(db, s.ctx, { redemptionId: a.id, decision: "FULFILLED" });
    await expect(cancelRedemption(db, s.kid.ctx, a.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
    await parentAdjustment(db, s.ctx, {
      familyId: s.family.id,
      childId: s.kid.child.id,
      currency: "POINTS",
      amount: 40,
      reason: "top up",
      idempotencyKey: "topup",
    });
    const d = await requestRedemption(db, s.kid.ctx, s.reward.id);
    await resolveRedemption(db, s.ctx, { redemptionId: d.id, decision: "DENIED" });
    await expect(cancelRedemption(db, s.kid.ctx, d.id)).rejects.toMatchObject({
      code: "INVALID_STATE",
    });
  });

  it("a parent cannot approve a cancelled request", async () => {
    const s = await setup();
    const req = await requestRedemption(db, s.kid.ctx, s.reward.id);
    await cancelRedemption(db, s.kid.ctx, req.id);
    await expect(
      resolveRedemption(db, s.ctx, { redemptionId: req.id, decision: "APPROVED" }),
    ).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
